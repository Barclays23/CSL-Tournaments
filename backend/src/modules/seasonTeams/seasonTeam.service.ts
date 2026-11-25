import mongoose, { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import type { ISeasonTeamService } from "./seasonTeam.interfaces.js";
import type { SeasonTeamResponseDto, UpdateSeasonTeamDto } from "./seasonTeam.dto.js";
import { SeasonTeamRepository } from "./seasonTeam.repository.js";
import { getSeasonTeamWithdrawalBlockers } from "./seasonTeam.withdrawal.rules.js";
import { canAssignSeasonTeamManagers, canAssignSeasonTeamGroups, MANAGER_ASSIGNMENT_SEASON_STATUSES } from "./seasonTeam.assignment.rules.js";

export class SeasonTeamService implements ISeasonTeamService {
  constructor(private readonly repository: SeasonTeamRepository) {}

  async list(seasonId: string): Promise<SeasonTeamResponseDto[]> {
    this.id(seasonId);
    if (!await this.repository.findSeasonState(seasonId)) {
      throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    }
    return (await this.repository.findPopulatedBySeason(seasonId)).map((record) => this.map(record));
  }

  async update(seasonId: string, id: string, input: UpdateSeasonTeamDto): Promise<SeasonTeamResponseDto> {
    this.id(seasonId);
    this.id(id);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const season = await this.repository.findSeasonState(seasonId, session);
        if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
        if (input.managerIds !== undefined && !canAssignSeasonTeamManagers(season.status)) {
          throw new AppError("Manager assignments are allowed until the season is completed", 409, "MANAGER_ASSIGNMENT_CLOSED");
        }
        if (!await this.repository.lockSeason(seasonId, MANAGER_ASSIGNMENT_SEASON_STATUSES, session)) {
          throw new AppError("Season participation is read-only", 409, "SEASON_CLOSED");
        }

        const current = await this.repository.findInSeason(seasonId, id, session);
        if (!current) throw new AppError("Season team not found in this season", 404, "SEASON_TEAM_NOT_FOUND");

        const patch: Record<string, unknown> = {};
        if (input.managerIds !== undefined) {
          if (new Set(input.managerIds).size !== input.managerIds.length) {
            throw new AppError("A manager can only be assigned once", 422, "DUPLICATE_MANAGER_ASSIGNMENT");
          }
          const managerIds = input.managerIds.map((managerId) => {
            if (!Types.ObjectId.isValid(managerId)) throw new AppError("Invalid manager ID", 400, "INVALID_MANAGER_ID");
            return new Types.ObjectId(managerId);
          });
          const activeCount = await this.repository.countActiveManagers(managerIds, session);
          if (activeCount !== managerIds.length) {
            throw new AppError("All assigned managers must be active", 422, "INVALID_MANAGER_ASSIGNMENT");
          }
          const conflictingTeams = await this.repository.findConflictingManagerAssignments(seasonId, id, managerIds, session);
          if (conflictingTeams.length) {
            throw new AppError(
              "A manager can only be assigned to one team in a season. Already assigned to: " + conflictingTeams.join(", "),
              409, "MANAGER_ALREADY_ASSIGNED",
              { managerIds: "Remove the manager from the other team before assigning them here" },
            );
          }
          patch.managerRefs = managerIds;
        }

        if (input.groupId !== undefined) {
          if (input.groupId !== null && !season.groupStageEnabled) {
            throw new AppError("Group assignment is unavailable because group-stage play is disabled for this season", 409, "GROUP_STAGE_DISABLED");
          }
          const fixtureCount = await this.repository.countFixtures(seasonId, session);
          if (!canAssignSeasonTeamGroups(season.status, fixtureCount)) {
            throw new AppError("Group assignment is locked after fixtures exist or the season becomes active. Use an audited correction workflow for a genuine correction.", 409, "GROUP_ASSIGNMENT_LOCKED");
          }
          if (input.groupId === null) {
            patch.groupRef = null;
          } else {
            if (!Types.ObjectId.isValid(input.groupId)) throw new AppError("Invalid group ID", 400, "INVALID_GROUP_ID");
            const group = await this.repository.findGroupInSeason(seasonId, input.groupId, session);
            if (!group) throw new AppError("Group must belong to the same season", 422, "INVALID_GROUP");
            patch.groupRef = group._id;
          }
        }
        if (Object.keys(patch).length) {
          await this.repository.updateInSeason(seasonId, id, patch, session);
        }
      });
    } finally {
      await session.endSession();
    }

    const updated = await this.repository.findPopulatedInSeason(seasonId, id);
    if (!updated) throw new AppError("Season team not found", 404, "SEASON_TEAM_NOT_FOUND");
    return this.map(updated);
  }

  async remove(seasonId: string, id: string): Promise<void> {
    this.id(seasonId);
    this.id(id);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const season = await this.repository.findSeasonState(seasonId, session);
        if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
        if (!["draft", "upcoming"].includes(season.status)) {
          throw new AppError("SeasonTeam registrations can only be removed before activation", 409, "SEASON_REGISTRATION_FROZEN");
        }
        if (!await this.repository.lockSeason(seasonId, ["draft", "upcoming"], session)) {
          throw new AppError("Season state changed while removing this registration. Refresh and try again.", 409, "SEASON_STATE_CONFLICT");
        }
        if (!await this.repository.findInSeason(seasonId, id, session)) {
          throw new AppError("Season team not found", 404, "SEASON_TEAM_NOT_FOUND");
        }
        const [lots, matches] = await Promise.all([
          this.repository.countTeamLots(seasonId, id, session),
          this.repository.countTeamFixtures(seasonId, id, session),
        ]);
        if (lots || matches) {
          throw new AppError("This registration has auction or fixture history and cannot be removed. Use controlled withdrawal instead.", 409, "SEASON_TEAM_REFERENCED");
        }
        await this.repository.deleteInSeason(seasonId, id, session);
      });
    } finally {
      await session.endSession();
    }
  }

  async withdraw(seasonId: string, id: string): Promise<SeasonTeamResponseDto> {
    this.id(seasonId);
    this.id(id);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const season = await this.repository.findSeasonState(seasonId, session);
        if (!season || season.status !== "active") {
          throw new AppError("Controlled withdrawal is available only during an Active season", 409, "SEASON_WITHDRAWAL_NOT_ALLOWED");
        }
        if (!await this.repository.lockSeason(seasonId, ["active"], session)) {
          throw new AppError("Season state changed while withdrawing this team. Refresh and try again.", 409, "SEASON_STATE_CONFLICT");
        }
        const current = await this.repository.findInSeason(seasonId, id, session);
        if (!current) throw new AppError("Season team not found", 404, "SEASON_TEAM_NOT_FOUND");
        const fixtures = await this.repository.findUnresolvedTeamFixtures(seasonId, id, session);
        const blockers = getSeasonTeamWithdrawalBlockers(current.status, fixtures);
        if (blockers.length) {
          throw new AppError("Withdrawal is blocked until every fixture is resolved. Completed fixtures remain as history; cancelled or abandoned fixtures need an audited decision.", 409, "WITHDRAWAL_VALIDATION_FAILED",
            Object.fromEntries(blockers.map((message, index) => ["blocker." + (index + 1), message])));
        }
        await this.repository.updateInSeason(seasonId, id, { status: "withdrawn", participationHistory: [...(current.participationHistory ?? []), { fromStatus: current.status, toStatus: "withdrawn", reason: "Withdrawn by tournament administrator", changedAt: new Date() }] }, session);
      });
    } finally {
      await session.endSession();
    }
    const updated = await this.repository.findPopulatedInSeason(seasonId, id);
    if (!updated) throw new AppError("Season team not found", 404, "SEASON_TEAM_NOT_FOUND");
    return this.map(updated);
  }

  async recall(seasonId: string, id: string, reason: string): Promise<SeasonTeamResponseDto> {
    this.id(seasonId); this.id(id);
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3 || normalizedReason.length > 500) throw new AppError("Provide a recall reason between 3 and 500 characters", 422, "INVALID_RECALL_REASON");
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const season = await this.repository.findSeasonState(seasonId, session);
        if (!season || season.status !== "active") throw new AppError("A withdrawn team can only be recalled during an Active season", 409, "SEASON_RECALL_NOT_ALLOWED");
        if (!await this.repository.lockSeason(seasonId, ["active"], session)) throw new AppError("Season state changed while recalling this team", 409, "SEASON_STATE_CONFLICT");
        const current = await this.repository.findInSeason(seasonId, id, session);
        if (!current) throw new AppError("Season team not found", 404, "SEASON_TEAM_NOT_FOUND");
        if (current.status !== "withdrawn") throw new AppError("Only a withdrawn SeasonTeam can be recalled", 409, "SEASON_RECALL_NOT_ALLOWED");
        const fixtures = await this.repository.findUnresolvedTeamFixtures(seasonId, id, session);
        const blockers = getSeasonTeamWithdrawalBlockers("active", fixtures);
        if (blockers.length) throw new AppError("This team cannot return until all its fixtures are resolved", 409, "SEASON_RECALL_FIXTURES_UNRESOLVED", Object.fromEntries(blockers.map((item, index) => ["blocker." + (index + 1), item])));
        if (!await this.repository.recallInSeason(seasonId, id, normalizedReason, session)) throw new AppError("SeasonTeam status changed before recall could be saved", 409, "SEASON_STATE_CONFLICT");
      });
    } finally { await session.endSession(); }
    const updated = await this.repository.findPopulatedInSeason(seasonId, id);
    if (!updated) throw new AppError("Season team not found", 404, "SEASON_TEAM_NOT_FOUND");
    return this.map(updated);
  }

  private map(record: any): SeasonTeamResponseDto {
    return {
      _id: String(record._id),
      seasonRef: String(record.seasonRef),
      teamRef: String(record.teamRef?._id ?? record.teamRef),
      displayName: record.teamRef?.name ?? record.displayName,
      logoSnapshot: record.teamRef?.logo ?? record.logoSnapshot,
      groupRef: record.groupRef ? String(record.groupRef._id ?? record.groupRef) : null,
      managerRefs: (record.managerRefs ?? []).map((manager: any) => String(manager._id ?? manager)),
      status: record.status,
      participationHistory: (record.participationHistory ?? []).map((entry: any) => ({ fromStatus: entry.fromStatus, toStatus: entry.toStatus, reason: entry.reason, changedAt: entry.changedAt.toISOString() })),
      team: record.teamRef && typeof record.teamRef === "object" && record.teamRef.name
        ? { _id: String(record.teamRef._id), name: record.teamRef.name, shortName: record.teamRef.shortName, logo: record.teamRef.logo }
        : null,
      group: record.groupRef?.groupName
        ? { _id: String(record.groupRef._id), groupName: record.groupRef.groupName, displayOrder: record.groupRef.displayOrder }
        : null,
      managers: (record.managerRefs ?? []).filter((manager: any) => manager.name).map((manager: any) => ({
        _id: String(manager._id), name: manager.name, role: manager.role, profilePic: manager.profilePic,
      })),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private id(value: string): void {
    if (!Types.ObjectId.isValid(value)) throw new AppError("Invalid ID", 400, "INVALID_ID");
  }
}
