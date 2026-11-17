import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import { SEASON_AWARD_CATEGORIES, type SeasonAwardEntity, type SeasonAwardFields, type SeasonAwardType } from "./seasonAward.types.js";
import type { CreateSeasonAwardDto, ISeasonAwardService, SeasonAwardResponseDto, UpdateSeasonAwardDto } from "./seasonAward.dto.js";
import { SeasonAwardRepository } from "./seasonAward.repository.js";
import { getSeasonAwardReadinessBlockers } from "./seasonAward.readiness.js";

const ELIGIBLE_TEAM_STATUSES = new Set(["registered", "active"]);

export class SeasonAwardService implements ISeasonAwardService {
  constructor(private readonly repository: SeasonAwardRepository) {}

  async list(seasonId: string): Promise<SeasonAwardResponseDto[]> {
    this.ensureId(seasonId, "season");
    if (!await this.repository.findSeasonStatus(seasonId)) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    return (await this.repository.findBySeason(seasonId)).map((award) => this.map(award));
  }

  async create(seasonId: string, input: CreateSeasonAwardDto): Promise<SeasonAwardResponseDto> {
    await this.ensureAwardReadiness(seasonId);
    this.ensureId(seasonId, "season");
    await this.ensureActiveSeason(seasonId);
    const fields = await this.buildFields(seasonId, input.awardType, input.title, input.description, input.recipients);
    this.ensureMandatoryAwardsDiffer(seasonId, input.awardType, fields.recipients);
    try {
      const created = await this.repository.createWhileActive(seasonId, fields);
      return this.map(created);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new AppError("This award category already exists for the selected season", 409, "DUPLICATE_SEASON_AWARD");
      this.mapLockedError(error);
    }
  }

  async update(seasonId: string, awardId: string, input: UpdateSeasonAwardDto): Promise<SeasonAwardResponseDto> {
    await this.ensureAwardReadiness(seasonId);
    this.ensureId(seasonId, "season");
    this.ensureId(awardId, "award");
    await this.ensureActiveSeason(seasonId);
    const current = await this.repository.findByIdInSeason(seasonId, awardId);
    if (!current) throw new AppError("Season award not found", 404, "SEASON_AWARD_NOT_FOUND");
    const awardType = input.awardType ?? current.awardType;
    const recipients = input.recipients
      ? await this.buildRecipients(seasonId, awardType, input.recipients)
      : current.recipients;
    this.validateRecipientRules(awardType, recipients);
    this.ensureMandatoryAwardsDiffer(seasonId, awardType, recipients, awardId);
    const patch: Partial<SeasonAwardFields> = {};
    if (input.awardType !== undefined) patch.awardType = input.awardType;
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.recipients !== undefined) patch.recipients = recipients;
    try {
      const updated = await this.repository.updateWhileActive(seasonId, awardId, patch);
      if (!updated) throw new AppError("Season award not found in this season", 404, "SEASON_AWARD_NOT_FOUND");
      return this.map(updated);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if ((error as { code?: number }).code === 11000) throw new AppError("This award category already exists for the selected season", 409, "DUPLICATE_SEASON_AWARD");
      this.mapLockedError(error);
    }
  }

  async delete(seasonId: string, awardId: string): Promise<void> {
    await this.ensureAwardReadiness(seasonId);
    this.ensureId(seasonId, "season");
    this.ensureId(awardId, "award");
    await this.ensureActiveSeason(seasonId);
    const award = await this.repository.findByIdInSeason(seasonId, awardId);
    if (!award) throw new AppError("Season award not found", 404, "SEASON_AWARD_NOT_FOUND");
    if (award.awardType === "champions" || award.awardType === "runner_up") {
      throw new AppError("Champion and Runner-up records are mandatory and cannot be deleted; update the selected team instead", 409, "MANDATORY_AWARD");
    }
    try {
      const deleted = await this.repository.deleteWhileActive(seasonId, awardId);
      if (!deleted) throw new AppError("Season award not found", 404, "SEASON_AWARD_NOT_FOUND");
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.mapLockedError(error);
    }
  }

  private async buildFields(
    seasonId: string,
    awardType: SeasonAwardType,
    title: string | undefined,
    description: string | null | undefined,
    inputRecipients: CreateSeasonAwardDto["recipients"],
  ): Promise<SeasonAwardFields> {
    const recipients = await this.buildRecipients(seasonId, awardType, inputRecipients);
    const category = SEASON_AWARD_CATEGORIES.find((item) => item.awardType === awardType)!;
    const resolvedTitle = title?.trim() || category.label;
    if (awardType === "special" && !title?.trim()) {
      throw new AppError("A title is required for a special award", 422, "AWARD_TITLE_REQUIRED", { title: "Enter a title for the special award" });
    }
    return {
      seasonRef: new Types.ObjectId(seasonId),
      awardType,
      title: resolvedTitle,
      description: description?.trim() || null,
      recipients,
    };
  }

  private async buildRecipients(
    seasonId: string,
    awardType: SeasonAwardType,
    inputs: CreateSeasonAwardDto["recipients"],
  ): Promise<SeasonAwardFields["recipients"]> {
    this.validateRecipientInputs(awardType, inputs);
    const keys = inputs.map((recipient) => recipient.playerId ? recipient.seasonTeamId + ":" + recipient.playerId : recipient.seasonTeamId + ":team");
    if (new Set(keys).size !== keys.length) throw new AppError("Duplicate award recipients are not allowed", 422, "DUPLICATE_AWARD_RECIPIENT");
    const results = [];
    for (const recipient of inputs) {
      const team = await this.repository.findSeasonTeam(seasonId, recipient.seasonTeamId);
      if (!team) throw new AppError("Every award recipient must reference a SeasonTeam from this season", 422, "INVALID_AWARD_SEASON_TEAM");
      if (!ELIGIBLE_TEAM_STATUSES.has(team.status)) throw new AppError("Award recipients must belong to an eligible participating team", 422, "INELIGIBLE_AWARD_TEAM");
      const playerId = recipient.playerId ?? null;
      if (playerId) {
        const player = await this.repository.findPlayerForSeasonTeam(seasonId, recipient.seasonTeamId, playerId);
        if (!player) throw new AppError("An individual award recipient must have a sold AuctionLot for the selected SeasonTeam in this season", 422, "INVALID_AWARD_PLAYER");
        results.push({
          recipientType: "player" as const,
          seasonTeamRef: new Types.ObjectId(recipient.seasonTeamId),
          playerRef: new Types.ObjectId(playerId),
          displayNameSnapshot: player.name,
          profileImageSnapshot: player.profilePic ?? null,
          teamNameSnapshot: team.teamRef?.name ?? team.displayName,
          teamLogoSnapshot: team.teamRef?.logo ?? team.logoSnapshot ?? null,
        });
      } else {
        results.push({
          recipientType: "season_team" as const,
          seasonTeamRef: new Types.ObjectId(recipient.seasonTeamId),
          playerRef: null,
          displayNameSnapshot: team.teamRef?.name ?? team.displayName,
          profileImageSnapshot: team.teamRef?.logo ?? team.logoSnapshot ?? null,
          teamNameSnapshot: team.teamRef?.name ?? team.displayName,
          teamLogoSnapshot: team.teamRef?.logo ?? team.logoSnapshot ?? null,
        });
      }
    }
    return results;
  }

  private validateRecipientInputs(awardType: SeasonAwardType, recipients: CreateSeasonAwardDto["recipients"]): void {
    if ((awardType === "champions" || awardType === "runner_up") && (recipients.length !== 1 || recipients[0]?.playerId)) {
      throw new AppError("Champions and Runner-up require exactly one SeasonTeam recipient", 422, "INVALID_TEAM_AWARD");
    }
    if (["golden_boot", "golden_glove", "player_of_the_season", "best_young_player", "best_defender", "best_midfielder"].includes(awardType)
      && recipients.some((recipient) => !recipient.playerId)) {
      throw new AppError("This award requires Player recipients linked to their SeasonTeam", 422, "INVALID_PLAYER_AWARD");
    }
  }

  private validateRecipientRules(awardType: SeasonAwardType, recipients: SeasonAwardFields["recipients"]): void {
    if ((awardType === "champions" || awardType === "runner_up") && (recipients.length !== 1 || recipients[0]?.recipientType !== "season_team")) {
      throw new AppError("Champions and Runner-up require exactly one SeasonTeam recipient", 422, "INVALID_TEAM_AWARD");
    }
    if (["golden_boot", "golden_glove", "player_of_the_season", "best_young_player", "best_defender", "best_midfielder"].includes(awardType)
      && recipients.some((recipient) => recipient.recipientType !== "player" || !recipient.playerRef)) {
      throw new AppError("This award requires Player recipients linked to their SeasonTeam", 422, "INVALID_PLAYER_AWARD");
    }
  }

  private async ensureMandatoryAwardsDiffer(
    seasonId: string,
    awardType: SeasonAwardType,
    recipients: SeasonAwardFields["recipients"],
    awardId?: string,
  ): Promise<void> {
    if (awardType !== "champions" && awardType !== "runner_up") return;
    const counterpartType = awardType === "champions" ? "runner_up" : "champions";
    const counterpart = await this.repository.findAwardTypeInSeason(seasonId, counterpartType);
    if (counterpart && String(counterpart._id) !== awardId
      && String(counterpart.recipients[0]?.seasonTeamRef) === String(recipients[0]?.seasonTeamRef)) {
      throw new AppError("Champion and Runner-up must be different SeasonTeams", 422, "SAME_CHAMPION_RUNNER_UP");
    }
  }

  private async ensureAwardReadiness(seasonId: string): Promise<void> {
    this.ensureId(seasonId, "season");
    const status = await this.repository.findSeasonStatus(seasonId);
    if (!status) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (status !== "active") throw new AppError("Season awards can only be changed while the season is Active; Completed and Archived history is read-only", 409, "SEASON_AWARDS_LOCKED");
    const blockers = getSeasonAwardReadinessBlockers(await this.repository.getAwardReadinessSnapshot(seasonId));
    if (blockers.length) throw new AppError("Achievements and awards are available after fixtures and auction activity are finalized", 409, "SEASON_AWARDS_NOT_READY", Object.fromEntries(blockers.map((item, index) => ["blocker." + (index + 1), item])));
  }

  private async ensureActiveSeason(seasonId: string): Promise<void> {
    const status = await this.repository.findSeasonStatus(seasonId);
    if (!status) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (status !== "active") {
      throw new AppError("Season awards can only be changed while the season is Active; Completed and Archived history is read-only", 409, "SEASON_AWARDS_LOCKED");
    }
  }

  private map(award: SeasonAwardEntity): SeasonAwardResponseDto {
    return {
      _id: String(award._id),
      seasonRef: String(award.seasonRef),
      awardType: award.awardType,
      title: award.title,
      description: award.description,
      recipients: award.recipients.map((recipient) => {
        const populatedSeasonTeam = recipient.seasonTeamRef as unknown as {
          _id?: Types.ObjectId;
          teamRef?: { name?: string; logo?: SeasonAwardFields["recipients"][number]["teamLogoSnapshot"] } | Types.ObjectId;
        };
        const currentTeam = populatedSeasonTeam?.teamRef && typeof populatedSeasonTeam.teamRef === "object"
          ? populatedSeasonTeam.teamRef as { name?: string; logo?: SeasonAwardFields["recipients"][number]["teamLogoSnapshot"] }
          : null;
        return {
          _id: String((recipient as typeof recipient & { _id?: Types.ObjectId })._id ?? ""),
          recipientType: recipient.recipientType,
          seasonTeamRef: String(populatedSeasonTeam?._id ?? recipient.seasonTeamRef),
          playerRef: recipient.playerRef ? String(recipient.playerRef) : null,
          displayNameSnapshot: recipient.displayNameSnapshot,
          profileImageSnapshot: recipient.profileImageSnapshot,
          teamNameSnapshot: currentTeam?.name ?? recipient.teamNameSnapshot,
          teamLogoSnapshot: currentTeam?.logo ?? recipient.teamLogoSnapshot,
        };
      }),
      createdAt: award.createdAt.toISOString(),
      updatedAt: award.updatedAt.toISOString(),
    };
  }

  private mapLockedError(error: unknown): never {
    if (error instanceof Error && error.message === "SEASON_AWARDS_LOCKED") {
      throw new AppError("Season awards cannot be changed after the season is completed or archived", 409, "SEASON_AWARDS_LOCKED");
    }
    throw error;
  }

  private ensureId(value: string, label: string): void {
    if (!Types.ObjectId.isValid(value)) throw new AppError("Invalid " + label + " ID", 400, "INVALID_ID");
  }
}
