import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import { isAllowedSeasonTransition, isSeasonIdentityEditable, normalizeSeasonName } from "./season.rules.js";
import type { ITeamRepository } from "../teams/team.interfaces.js";
import { SeasonTeamRepository } from "../seasonTeams/seasonTeam.repository.js";
import type { SeasonTeamEntity } from "../seasonTeams/seasonTeam.types.js";
import type { ISeasonRepository, ISeasonService } from "./season.interfaces.js";
import type { CreateSeasonDto, UpdateSeasonDto, SeasonQueryDto, SeasonResponseDto, RegisterSeasonTeamsDto, SeasonLifecycleDto } from "./season.dto.js";
import type { SeasonEntity, SeasonFields, SeasonStatus } from "./season.types.js";

const dateOnly = (value: Date | null | undefined): string | null => value ? value.toISOString().slice(0, 10) : null;

export class SeasonService implements ISeasonService {
  constructor(
    private readonly repo: ISeasonRepository,
    private readonly teams: ITeamRepository,
    private readonly seasonTeams: SeasonTeamRepository,
  ) {}

  async list(query: SeasonQueryDto): Promise<SeasonResponseDto[]> {
    return (await this.repo.findSeasons(query)).map((season) => this.map(season));
  }

  async get(id: string): Promise<SeasonResponseDto> {
    this.ensureId(id);
    const season = await this.repo.findById(id);
    if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    return this.map(season);
  }

  async create(input: CreateSeasonDto): Promise<SeasonResponseDto> {
    const name = normalizeSeasonName(input.name);
    if (await this.repo.findByNumber(input.seasonNumber)) {
      throw new AppError("Season number already exists", 409, "DUPLICATE_SEASON_NUMBER", { seasonNumber: "Choose a unique edition number" });
    }
    if (await this.repo.findByNormalizedName(name)) {
      throw new AppError("A season with this name already exists", 409, "DUPLICATE_SEASON_NAME", { name: "Season name must be unique" });
    }
    if (input.teamIds.length > input.auctionSettings.seasonTeamCount) {
      throw new AppError("Selected teams exceed the season team limit", 422, "SEASON_TEAM_LIMIT");
    }
    const snapshots = await Promise.all(input.teamIds.map(async (id) => {
      if (!Types.ObjectId.isValid(id)) throw new AppError("Invalid team ID", 400, "INVALID_TEAM_ID");
      const team = await this.teams.findTeamById(id);
      if (!team || team.status !== "active") throw new AppError("All selected teams must be active permanent teams", 422, "INVALID_SEASON_TEAM");
      return { _id: team._id, name: team.name, logo: team.logo };
    }));
    try {
      const created = await this.repo.createWithTeams(input, name, snapshots);
      return this.map(created);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) this.throwDuplicateKey(error);
      if (error instanceof Error && error.message === "SEASON_TEAM_INACTIVE") {
        throw new AppError("A selected permanent Team became inactive before registration completed", 409, "INVALID_SEASON_TEAM");
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateSeasonDto): Promise<SeasonResponseDto> {
    this.ensureId(id);
    const current = await this.repo.findById(id);
    if (!current) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (current.status === "completed" || current.status === "archived") {
      throw new AppError("Completed and archived seasons are permanently read-only", 409, "SEASON_READ_ONLY");
    }
    if (current.status === "active") {
      throw new AppError("Active-season configuration requires a separate audited correction operation", 409, "ACTIVE_SEASON_CONFIG_LOCKED");
    }

    const [teamCount, groupCount, lotCount, matchCount, maxSquad] = await Promise.all([
      this.repo.countSeasonTeams(id),
      this.repo.countGroups(id),
      this.repo.countLots(id),
      this.repo.countMatches(id),
      this.repo.getMaxSoldSquadSize(id),
    ]);
    const hasIdentityDependencies = teamCount + groupCount + lotCount + matchCount > 0;
    const identityFields = ["name", "seasonNumber", "year"] as const;
    const requestedIdentityFields = identityFields.filter((field) => input[field] !== undefined && input[field] !== current[field]);
    if (requestedIdentityFields.length && !isSeasonIdentityEditable(current.status, hasIdentityDependencies)) {
      const reason = "Season name, edition number and year can only be changed on an empty Draft season";
      throw new AppError(reason, 409, "SEASON_IDENTITY_LOCKED",
        Object.fromEntries(requestedIdentityFields.map((field) => [
          field,
          "This identity field is locked because the season is not an empty Draft season",
        ])));
    }
    if (input.auctionSettings && lotCount > 0) {
      throw new AppError("Auction settings are locked after the first AuctionLot is created, regardless of its status", 409, "SEASON_AUCTION_LOCKED", {
        auctionSettings: "Auction history already exists for this season",
      });
    }
    if (input.auctionSettings) {
      const currentAuctionSettings = current.auctionSettings;
      if (!currentAuctionSettings) {
        throw new AppError("Auction settings are unavailable for this historical season", 409, "SEASON_CONFIG_REQUIRED");
      }
      const merged: NonNullable<SeasonEntity["auctionSettings"]> = {
        currency: input.auctionSettings.currency ?? currentAuctionSettings.currency,
        budgetPerTeam: input.auctionSettings.budgetPerTeam ?? currentAuctionSettings.budgetPerTeam,
        playersCount: input.auctionSettings.playersCount ?? currentAuctionSettings.playersCount,
        seasonTeamCount: input.auctionSettings.seasonTeamCount ?? currentAuctionSettings.seasonTeamCount,
        teamSquadSize: input.auctionSettings.teamSquadSize ?? currentAuctionSettings.teamSquadSize,
        iconPlayerLimit: input.auctionSettings.iconPlayerLimit ?? currentAuctionSettings.iconPlayerLimit,
        goalkeeperLimit: input.auctionSettings.goalkeeperLimit ?? currentAuctionSettings.goalkeeperLimit,
      };
      if (merged.seasonTeamCount < teamCount) throw new AppError("Team limit cannot be lower than current registrations", 409, "SEASON_TEAM_LIMIT_LOCKED", {
        auctionSettings: "The new team limit is below the number of registered SeasonTeams",
      });
      if (merged.playersCount < lotCount) throw new AppError("Nomination limit cannot be lower than existing auction lots", 409, "SEASON_PLAYER_LIMIT_LOCKED", {
        auctionSettings: "The new nomination limit is below the number of existing AuctionLots",
      });
      if (merged.teamSquadSize < maxSquad) throw new AppError("Squad size cannot be lower than an existing sold roster", 409, "SEASON_SQUAD_SIZE_LOCKED", {
        auctionSettings: "The new squad size is below an existing sold roster",
      });
      if (merged.iconPlayerLimit > merged.teamSquadSize) throw new AppError("Icon Player limit cannot exceed the team squad size", 422, "INVALID_AUCTION_SETTINGS", {
        "auctionSettings.iconPlayerLimit": "Reduce the Icon Player limit or increase the squad size",
      });
      if (merged.goalkeeperLimit > merged.teamSquadSize) throw new AppError("Goalkeeper limit cannot exceed the team squad size", 422, "INVALID_AUCTION_SETTINGS", {
        "auctionSettings.goalkeeperLimit": "Reduce the Goalkeeper limit or increase the squad size",
      });
    }
    if ((input.pointsRules || input.standingsTieBreakers || input.matchRules || input.groupStageEnabled !== undefined) && matchCount > 0) {
      throw new AppError("Points, tiebreaker, match and group-stage rules are locked after the first fixture is created", 409, "SEASON_MATCH_RULES_LOCKED", {
        pointsRules: "Fixtures already exist",
        standingsTieBreakers: "Fixtures already exist",
        matchRules: "Fixtures already exist",
        groupStageEnabled: "Fixtures already exist",
      });
    }

    const effectiveTimeZone = input.timeZone ?? current.timeZone;
    if (input.timeZone !== undefined && input.timeZone !== current.timeZone && matchCount > 0) {
      throw new AppError("Season timezone cannot change after fixtures exist", 409, "SEASON_TIMEZONE_LOCKED", {
        timeZone: "Existing fixture timestamps already use the season timezone",
      });
    }
    const nextStart = input.startDate === undefined ? current.startDate : input.startDate;
    const nextEnd = input.endDate === undefined ? current.endDate : input.endDate;
    if (nextStart && nextEnd && nextEnd < nextStart) {
      throw new AppError("End date must be on or after start date", 422, "INVALID_SEASON_DATES", { endDate: "End date must be on or after start date" });
    }
    if (input.startDate !== undefined || input.endDate !== undefined) {
      const fixtures = await this.repo.getMatches(id);
      const startDay = dateOnly(nextStart);
      const endDay = dateOnly(nextEnd);
      const outOfRange = fixtures.filter((fixture) => {
        const fixtureDay = new Intl.DateTimeFormat("en-CA", { timeZone: effectiveTimeZone }).format(fixture.kickoffAt);
        return (startDay !== null && fixtureDay < startDay) || (endDay !== null && fixtureDay > endDay);
      });
      if (outOfRange.length) {
        throw new AppError("Season dates cannot exclude existing fixtures", 409, "SEASON_DATE_RANGE_LOCKED", {
          fixtures: outOfRange.map((fixture) => "Match " + fixture.matchNumber + " is outside the proposed season date range").join("; "),
        });
      }
    }
    const nextName = input.name === undefined ? current.name : input.name.trim();
    const normalizedName = normalizeSeasonName(nextName);
    if (input.name !== undefined && await this.repo.findByNormalizedName(normalizedName, id)) {
      throw new AppError("A season with this name already exists", 409, "DUPLICATE_SEASON_NAME", { name: "Season name must be unique" });
    }
    if (input.seasonNumber !== undefined && await this.repo.findByNumber(input.seasonNumber, id)) {
      throw new AppError("Season number already exists", 409, "DUPLICATE_SEASON_NUMBER", { seasonNumber: "Choose a unique edition number" });
    }

    const update: Partial<SeasonFields> = {};
    if (input.seasonNumber !== undefined) update.seasonNumber = input.seasonNumber;
    if (input.name !== undefined) {
      update.name = nextName;
      update.normalizedName = normalizedName;
    }
    if (input.year !== undefined) update.year = input.year;
    if (input.startDate !== undefined) update.startDate = input.startDate;
    if (input.endDate !== undefined) update.endDate = input.endDate;
    if (input.timeZone !== undefined) update.timeZone = input.timeZone;
    if (input.groupStageEnabled !== undefined) update.groupStageEnabled = input.groupStageEnabled;
    if (input.auctionSettings) update.auctionSettings = { ...current.auctionSettings!, ...input.auctionSettings };
    if (input.pointsRules) update.pointsRules = { ...current.pointsRules!, ...input.pointsRules };
    if (input.standingsTieBreakers) update.standingsTieBreakers = input.standingsTieBreakers;
    if (input.matchRules) update.matchRules = { ...current.matchRules!, ...input.matchRules };
    try {
      const updated = await this.repo.update(id, update);
      if (!updated) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
      return this.map(updated);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) this.throwDuplicateKey(error);
      throw error;
    }
  }

  async transition(id: string, input: SeasonLifecycleDto): Promise<SeasonResponseDto> {
    this.ensureId(id);
    const current = await this.repo.findById(id);
    if (!current) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    const next = input.status;
    const allowed = isAllowedSeasonTransition(current.status, next);
    if (!allowed) throw new AppError("This season lifecycle transition is not allowed", 409, "INVALID_SEASON_TRANSITION", {
      status: current.status + " cannot transition to " + next,
    });
    if (next === "draft") {
      const [lots, matches] = await Promise.all([this.repo.countLots(id), this.repo.countMatches(id)]);
      if (lots || matches) throw new AppError("An Upcoming season can only be reopened to Draft before auction or fixture activity", 409, "SEASON_REOPEN_BLOCKED");
    } else {
      await this.validateReadiness(current);
    }
    try {
      const updated = await this.repo.updateStatus(id, current.status, next);
      if (!updated) throw new AppError("Season state changed concurrently. Refresh and try again.", 409, "SEASON_STATE_CONFLICT");
      return this.map(updated);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new AppError("Another season is already Active", 409, "ACTIVE_SEASON_EXISTS", { status: "Only one Active season is allowed globally" });
      }
      throw error;
    }
  }

  async complete(id: string): Promise<SeasonResponseDto> {
    this.ensureId(id);
    const current = await this.repo.findById(id);
    if (!current) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (current.status !== "active") throw new AppError("Only the Active season can be completed", 409, "SEASON_NOT_ACTIVE");
    const result = await this.repo.completeIfReady(id);
    if (result.blockers.length) {
      throw new AppError("Season completion is blocked. Resolve the listed items first.", 422, "SEASON_COMPLETION_BLOCKED",
        Object.fromEntries(result.blockers.map((message, index) => ["blocker." + (index + 1), message])));
    }
    if (!result.season) throw new AppError("Season state changed concurrently. Refresh and try again.", 409, "SEASON_STATE_CONFLICT");
    return this.map(result.season);
  }

  async archive(id: string): Promise<SeasonResponseDto> {
    this.ensureId(id);
    const current = await this.repo.findById(id);
    if (!current) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (current.status !== "completed") throw new AppError("Only a Completed season can be archived", 409, "SEASON_ARCHIVE_BLOCKED");
    const archived = await this.repo.updateStatus(id, "completed", "archived");
    if (!archived) throw new AppError("Season state changed concurrently. Refresh and try again.", 409, "SEASON_STATE_CONFLICT");
    return this.map(archived);
  }

  async delete(id: string): Promise<void> {
    this.ensureId(id);
    try {
      const deleted = await this.repo.deleteIfEmptyDraft(id);
      if (!deleted) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    } catch (error) {
      if (error instanceof Error && error.message === "SEASON_NOT_FOUND") {
        throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
      }
      if (error instanceof Error && error.message === "SEASON_NOT_EMPTY_DRAFT") {
        throw new AppError("Only an empty Draft season can be deleted", 409, "SEASON_DELETE_BLOCKED");
      }
      if (error instanceof Error && error.message === "SEASON_DELETE_CONFLICT") {
        throw new AppError("Season changed while deletion was in progress. Refresh and try again.", 409, "SEASON_DELETE_CONFLICT");
      }
      if (error instanceof Error && error.message === "SEASON_HAS_DEPENDENCIES") {
        throw new AppError("This season has registrations, groups, auction lots or fixtures. Remove only unused setup records first; historical dependencies are never cascade-deleted.", 409, "SEASON_HAS_DEPENDENCIES");
      }
      throw error;
    }
  }

  async registerTeams(id: string, input: RegisterSeasonTeamsDto): Promise<SeasonTeamEntity[]> {
    this.ensureId(id);
    const season = await this.repo.findById(id);
    if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (!["draft", "upcoming"].includes(season.status)) throw new AppError("Team registration is frozen after the season becomes Active", 409, "SEASON_REGISTRATION_FROZEN");
    if (!season.auctionSettings) throw new AppError("Auction settings must be configured before registering teams", 422, "SEASON_CONFIG_REQUIRED");
    if (new Set(input.teamIds).size !== input.teamIds.length) throw new AppError("A team can only be registered once in a season", 422, "DUPLICATE_SEASON_TEAM");
    const existing = await this.seasonTeams.findBySeason(id);
    const known = new Set(existing.map((team) => String(team.teamRef)));
    if (input.teamIds.some((teamId) => known.has(teamId))) throw new AppError("One or more teams are already registered", 409, "DUPLICATE_SEASON_TEAM");
    if (existing.length + input.teamIds.length > season.auctionSettings.seasonTeamCount) throw new AppError("Season team limit exceeded", 422, "SEASON_TEAM_LIMIT");
    const records = await Promise.all(input.teamIds.map(async (teamId) => {
      if (!Types.ObjectId.isValid(teamId)) throw new AppError("Invalid team ID", 400, "INVALID_TEAM_ID");
      const team = await this.teams.findTeamById(teamId);
      if (!team || team.status !== "active") throw new AppError("Selected team is not an active permanent Team", 422, "INVALID_SEASON_TEAM");
      return {
        seasonRef: new Types.ObjectId(id),
        teamRef: new Types.ObjectId(teamId),
        displayName: team.name,
        logoSnapshot: team.logo,
        groupRef: null,
        managerRefs: [],
        status: "registered" as const,
      };
    }));
    try {
      return await this.repo.registerTeamsAtomically(id, records, season.auctionSettings.seasonTeamCount);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new AppError("One or more teams are already registered in this season", 409, "DUPLICATE_SEASON_TEAM");
      if (error instanceof Error && error.message === "SEASON_TEAM_LIMIT") throw new AppError("Season team limit exceeded", 422, "SEASON_TEAM_LIMIT");
      if (error instanceof Error && error.message === "SEASON_TEAM_INACTIVE") throw new AppError("A selected permanent Team is no longer active", 409, "INVALID_SEASON_TEAM");
      if (error instanceof Error && error.message === "SEASON_REGISTRATION_FROZEN") throw new AppError("Team registration is frozen after the season becomes Active", 409, "SEASON_REGISTRATION_FROZEN");
      throw error;
    }
  }

  private async validateReadiness(season: SeasonEntity): Promise<void> {
    if (!season.auctionSettings || !season.pointsRules || !season.standingsTieBreakers?.length || !season.matchRules) {
      throw new AppError("Complete the Season rules before moving it to Upcoming or Active", 422, "SEASON_CONFIG_INCOMPLETE");
    }
    const [teamCount, eligibleTeamCount] = await Promise.all([
      this.repo.countSeasonTeams(String(season._id)),
      this.repo.countEligibleSeasonTeams(String(season._id)),
    ]);
    if (eligibleTeamCount < 2) {
      throw new AppError("At least two eligible participating teams are required", 422, "SEASON_TEAMS_REQUIRED", {
        teams: "Register at least two teams that are not withdrawn, eliminated or completed",
      });
    }
    if (teamCount > season.auctionSettings.seasonTeamCount) {
      throw new AppError("Registered teams exceed the configured team limit", 422, "SEASON_TEAM_LIMIT");
    }
    if (season.groupStageEnabled) {
      const readiness = await this.repo.getGroupReadiness(String(season._id));
      const errors: Record<string, string> = {};
      if (readiness.groupCount === 0) errors.groups = "Create at least one season-scoped Group";
      if (readiness.unassignedTeamCount > 0) errors.unassignedTeams = readiness.unassignedTeamCount + " participating team(s) need a Group";
      if (readiness.undersizedGroups.length > 0) errors.groupSizes = "Every Group must contain at least two eligible teams: " + readiness.undersizedGroups.join(", ");
      if (Object.keys(errors).length) throw new AppError("Group-stage setup is incomplete", 422, "SEASON_GROUPS_INCOMPLETE", errors);
    }
  }

  private map(season: SeasonEntity): SeasonResponseDto {
    return {
      _id: String(season._id),
      seasonNumber: season.seasonNumber,
      name: season.name,
      year: season.year,
      startDate: dateOnly(season.startDate),
      endDate: dateOnly(season.endDate),
      timeZone: season.timeZone,
      groupStageEnabled: season.groupStageEnabled ?? true,
      status: season.status,
      historyCompleteness: season.historyCompleteness ?? "not_applicable",
      auctionSettings: season.auctionSettings,
      pointsRules: season.pointsRules,
      standingsTieBreakers: season.standingsTieBreakers,
      matchRules: season.matchRules,
      createdAt: season.createdAt.toISOString(),
      updatedAt: season.updatedAt.toISOString(),
    };
  }

  private throwDuplicateKey(error: unknown): never {
    const key = (error as { keyPattern?: Record<string, number> }).keyPattern ?? {};
    if (key.seasonNumber) throw new AppError("Season number already exists", 409, "DUPLICATE_SEASON_NUMBER", { seasonNumber: "Choose a unique edition number" });
    throw new AppError("A season with this name already exists", 409, "DUPLICATE_SEASON_NAME", { name: "Season name must be unique" });
  }

  private ensureId(id: string): void {
    if (!Types.ObjectId.isValid(id)) throw new AppError("Invalid season ID", 400, "INVALID_ID");
  }
}
