import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import type { CreateGroupDto, GroupResponseDto, UpdateGroupDto } from "./group.dto.js";
import type { IGroupRepository, IGroupService } from "./group.interfaces.js";
import type { GroupEntity } from "./group.types.js";
import { normalizeGroupName } from "./group.repository.js";

export class GroupService implements IGroupService {
  constructor(private readonly _groupRepository: IGroupRepository) {}

  async list(seasonId: string): Promise<GroupResponseDto[]> {
    this.ensureId(seasonId, "season");
    const season = await this._groupRepository.getSeasonState(seasonId);
    if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    return (await this._groupRepository.findBySeason(seasonId)).map((group) => this.map(group));
  }

  async create(seasonId: string, input: CreateGroupDto): Promise<GroupResponseDto> {
    this.ensureId(seasonId, "season");
    const season = await this.getEditableSeason(seasonId, "create");
    if (!season.groupStageEnabled) {
      throw new AppError("Groups are not enabled for this season", 409, "GROUP_STAGE_DISABLED");
    }
    if (await this._groupRepository.countFixtures(seasonId) > 0) {
      throw new AppError("Groups cannot be added after the first fixture is created", 409, "GROUPS_LOCKED");
    }
    if (await this._groupRepository.countSeasonTeams(seasonId) === 0) {
      throw new AppError("Register participating SeasonTeams before creating season groups", 409, "SEASON_TEAMS_REQUIRED");
    }
    if (await this._groupRepository.findByName(seasonId, input.groupName)) {
      throw new AppError("A group with this name already exists in this season", 409, "DUPLICATE_GROUP");
    }

    try {
      const created = await this._groupRepository.create({
        seasonRef: new Types.ObjectId(seasonId),
        groupName: input.groupName.trim(),
        normalizedGroupName: normalizeGroupName(input.groupName),
        displayOrder: input.displayOrder ?? 0,
      });
      return this.map(created);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new AppError("A group with this name already exists in this season", 409, "DUPLICATE_GROUP");
      }
      throw error;
    }
  }

  async update(seasonId: string, groupId: string, input: UpdateGroupDto): Promise<GroupResponseDto> {
    this.ensureId(seasonId, "season");
    this.ensureId(groupId, "group");
    const season = await this.getEditableSeason(seasonId, "edit");
    if (!season.groupStageEnabled) {
      throw new AppError("Groups are not enabled for this season", 409, "GROUP_STAGE_DISABLED");
    }
    if (await this._groupRepository.countFixtures(seasonId) > 0) {
      throw new AppError("Groups cannot be renamed or reordered after fixtures exist", 409, "GROUPS_LOCKED");
    }
    const current = await this._groupRepository.findInSeason(seasonId, groupId);
    if (!current) throw new AppError("Group not found in this season", 404, "GROUP_NOT_FOUND");

    if (input.groupName !== undefined) {
      const duplicate = await this._groupRepository.findByName(seasonId, input.groupName);
      if (duplicate && String(duplicate._id) !== groupId) {
        throw new AppError("A group with this name already exists in this season", 409, "DUPLICATE_GROUP");
      }
    }

    try {
      const updated = await this._groupRepository.updateInSeason(seasonId, groupId, input);
      if (!updated) throw new AppError("Group not found in this season", 404, "GROUP_NOT_FOUND");
      return this.map(updated);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new AppError("A group with this name already exists in this season", 409, "DUPLICATE_GROUP");
      }
      throw error;
    }
  }

  async delete(seasonId: string, groupId: string): Promise<void> {
    this.ensureId(seasonId, "season");
    this.ensureId(groupId, "group");
    const season = await this.getEditableSeason(seasonId, "delete");
    if (!season.groupStageEnabled) {
      throw new AppError("Groups are not enabled for this season", 409, "GROUP_STAGE_DISABLED");
    }
    const group = await this._groupRepository.findInSeason(seasonId, groupId);
    if (!group) throw new AppError("Group not found in this season", 404, "GROUP_NOT_FOUND");
    const [assignmentCount, fixtureReferenceCount] = await Promise.all([
      this._groupRepository.countAssignments(seasonId, groupId),
      this._groupRepository.countMatchReferences(seasonId, groupId),
    ]);
    if (assignmentCount > 0 || fixtureReferenceCount > 0) {
      const blockers = [
        ...(assignmentCount > 0 ? [`${assignmentCount} team registration(s) are assigned to this group`] : []),
        ...(fixtureReferenceCount > 0 ? [`${fixtureReferenceCount} fixture(s) reference this group or one of its assigned teams`] : []),
      ];
      throw new AppError(
        "This group cannot be deleted: " + blockers.join("; ") + ". Team assignments must be removed before fixtures are created, and existing fixture history must be preserved.",
        409,
        "GROUP_REFERENCED",
      );
    }
    if (!await this._groupRepository.deleteInSeason(seasonId, groupId)) {
      throw new AppError("Group could not be deleted. Refresh and try again.", 409, "GROUP_DELETE_CONFLICT");
    }
  }

  private async getEditableSeason(
    seasonId: string,
    action: "create" | "edit" | "delete",
  ): Promise<NonNullable<Awaited<ReturnType<IGroupRepository["getSeasonState"]>>>> {
    const season = await this._groupRepository.getSeasonState(seasonId);
    if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (season.status !== "draft" && season.status !== "upcoming") {
      const verb = action === "create" ? "created" : action === "edit" ? "edited" : "deleted";
      throw new AppError(`Groups cannot be ${verb} after season activation`, 409, "GROUPS_LOCKED");
    }
    return season;
  }

  private map(group: GroupEntity): GroupResponseDto {
    return {
      _id: String(group._id),
      seasonRef: String(group.seasonRef),
      groupName: group.groupName,
      displayOrder: group.displayOrder,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  private ensureId(value: string, label: string): void {
    if (!Types.ObjectId.isValid(value)) throw new AppError(`Invalid ${label} ID`, 400, "INVALID_ID");
  }
}
