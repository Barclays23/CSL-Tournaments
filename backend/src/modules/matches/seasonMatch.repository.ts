import mongoose, { Types } from "mongoose";
import type { ClientSession } from "mongoose";
import type { SeasonMatchFields, SeasonMatchEntity, SeasonMatchListFilter, PopulatedSeasonMatch, MatchAuditHistoryEntry, MatchEventAuditHistoryEntry, SeasonMatchStatusHistoryEntry } from "./seasonMatch.types.js";
import { SeasonMatchModel } from "./seasonMatch.model.js";
import { SeasonModel } from "../seasons/season.model.js";
import { SeasonTeamModel } from "../seasonTeams/seasonTeam.model.js";
import { GroupModel } from "../groups/group.model.js";
import { PlayerModel } from "../players/player.model.js";
import { AuctionLotModel } from "../auctionLots/auctionLot.model.js";
import type { SeasonEntity, SeasonStatus } from "../seasons/season.types.js";
import type { SeasonTeamEntity } from "../seasonTeams/seasonTeam.types.js";
import type { PlayerEntity } from "../players/player.types.js";
import type { AuctionLotEntity } from "../auctionLots/auctionLot.types.js";
import { AppError } from "../../shared/errors/appError.js";
import { getLiveMatchConflictingTeamIds, getPairFixtureError } from "./seasonMatch.fixtureRules.js";
import { hasRecordedMatchIncidents } from "./seasonMatch.deletion.js";

const population = [
  { path: "homeSeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "awaySeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "winnerSeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "goals.scoringSeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "goals.playerSeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "goals.scorerPlayerRef", select: "name profilePic" },
  { path: "cards.seasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "cards.playerRef", select: "name profilePic" },
  { path: "venueRef", select: "name location" },
];

export class SeasonMatchRepository {
  async find(filter: SeasonMatchListFilter, page: number, limit: number): Promise<{ items: PopulatedSeasonMatch[]; total: number }> {
    const [items, total] = await Promise.all([
      SeasonMatchModel.find(filter).sort({ kickoffAt: 1, matchNumber: 1 }).skip((page - 1) * limit).limit(limit).populate(population).lean<PopulatedSeasonMatch[]>().exec(),
      SeasonMatchModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
  async findSeasonTeamIdsByName(seasonId: string, search: string): Promise<Types.ObjectId[]> {
    const escaped = search.split("").map((character) => "\\^$.*+?()[]{}|".includes(character) ? `\\${character}` : character).join("");
    const rows = await SeasonTeamModel.find({ seasonRef: new Types.ObjectId(seasonId), displayName: { $regex: escaped, $options: "i" } }).select("_id").lean<Array<{ _id: Types.ObjectId }>>().exec();
    return rows.map((row) => row._id);
  }
  async findById(id: string): Promise<SeasonMatchEntity | null> { return SeasonMatchModel.findById(id).lean<SeasonMatchEntity>().exec(); }
  async findByStage(seasonId: string, stage: SeasonMatchEntity["stage"]): Promise<SeasonMatchEntity[]> {
    return SeasonMatchModel.find({ seasonRef: new Types.ObjectId(seasonId), stage }).sort({ kickoffAt: 1, matchNumber: 1 }).lean<SeasonMatchEntity[]>().exec();
  }
  async findSeasonTeams(seasonId: string): Promise<SeasonTeamEntity[]> {
    return SeasonTeamModel.find({ seasonRef: new Types.ObjectId(seasonId) }).lean<SeasonTeamEntity[]>().exec();
  }

  async getGroupReadiness(seasonId: string): Promise<{
    groupCount: number;
    unassignedTeamCount: number;
    undersizedGroups: string[];
    emptyGroups: string[];
  }> {
    const seasonRef = new Types.ObjectId(seasonId);
    const [groups, teams] = await Promise.all([
      GroupModel.find({ seasonRef }).select("_id groupName").lean<Array<{ _id: Types.ObjectId; groupName: string }>>().exec(),
      SeasonTeamModel.find({ seasonRef, status: { $nin: ["withdrawn", "eliminated", "completed"] } })
        .select("_id groupRef")
        .lean<Array<{ _id: Types.ObjectId; groupRef: Types.ObjectId | null }>>()
        .exec(),
    ]);
    const groupIds = new Set(groups.map((group) => String(group._id)));
    const counts = new Map<string, number>();
    let unassignedTeamCount = 0;
    for (const team of teams) {
      const groupId = team.groupRef ? String(team.groupRef) : "";
      if (!groupId || !groupIds.has(groupId)) unassignedTeamCount += 1;
      else counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
    }
    return {
      groupCount: groups.length,
      unassignedTeamCount,
      undersizedGroups: groups.filter((group) => {
        const count = counts.get(String(group._id)) ?? 0;
        return count > 0 && count < 2;
      }).map((group) => group.groupName),
      emptyGroups: groups.filter((group) => (counts.get(String(group._id)) ?? 0) === 0).map((group) => group.groupName),
    };
  }

  async findPopulatedById(id: string): Promise<PopulatedSeasonMatch | null> { return SeasonMatchModel.findById(id).populate(population).lean<PopulatedSeasonMatch>().exec(); }
  async findByNumber(seasonId: string, number: number): Promise<SeasonMatchEntity | null> { return SeasonMatchModel.findOne({ seasonRef: new Types.ObjectId(seasonId), matchNumber: number }).lean<SeasonMatchEntity>().exec(); }
  async findSeason(id: string): Promise<SeasonEntity | null> { return SeasonModel.findById(id).lean<SeasonEntity>().exec(); }
  async findPairFixtures(seasonId: string, stage: SeasonMatchEntity["stage"], groupId: string | null, homeId: string, awayId: string): Promise<SeasonMatchEntity[]> {
    return SeasonMatchModel.find({
      seasonRef: new Types.ObjectId(seasonId), stage,
      groupRef: groupId ? new Types.ObjectId(groupId) : null,
      $or: [
        { homeSeasonTeamRef: new Types.ObjectId(homeId), awaySeasonTeamRef: new Types.ObjectId(awayId) },
        { homeSeasonTeamRef: new Types.ObjectId(awayId), awaySeasonTeamRef: new Types.ObjectId(homeId) },
      ],
    }).lean<SeasonMatchEntity[]>().exec();
  }
  async findVenue(id: string) {
    const { VenueModel } = await import("../venues/venue.model.js");
    return VenueModel.findById(id).lean<{ _id: Types.ObjectId; name: string; location: string | null; status: "active" | "inactive" }>().exec();
  }
  async findSeasonTeam(seasonId: string, id: string): Promise<SeasonTeamEntity | null> { return SeasonTeamModel.findOne({ _id: new Types.ObjectId(id), seasonRef: new Types.ObjectId(seasonId) }).lean<SeasonTeamEntity>().exec(); }
  async findGroup(seasonId: string, id: string) { return GroupModel.findOne({ _id: new Types.ObjectId(id), seasonRef: new Types.ObjectId(seasonId) }).lean().exec(); }
  async findPlayer(id: string): Promise<PlayerEntity | null> { return PlayerModel.findById(id).lean<PlayerEntity>().exec(); }
  async findSoldLot(seasonId: string, playerId: string): Promise<AuctionLotEntity | null> { return AuctionLotModel.findOne({ seasonRef: new Types.ObjectId(seasonId), playerRef: new Types.ObjectId(playerId), auctionStatus: "sold" }).lean<AuctionLotEntity>().exec(); }
  /**
   * Fixture record/schedule mutations increment the season revision in the same
   * transaction as auction completion, preventing stale fixture snapshots.
   * Match progress operations use the same transaction boundary but deliberately
   * do not take the auction revision lock or require a completed auction.
   */
  private async withSeasonWriteLock<T>(seasonId: string, work: (session: ClientSession) => Promise<T>, allowCompleted = false, requireAuctionCompleted = true): Promise<T> {
    const session = await mongoose.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        const allowedStatuses: SeasonStatus[] = allowCompleted ? ["upcoming", "active", "completed"] : ["upcoming", "active"];
        if (requireAuctionCompleted) {
          const lock = await SeasonModel.updateOne(
            { _id: new Types.ObjectId(seasonId), status: { $in: allowedStatuses }, auctionLifecycleStatus: "completed" },
            { $inc: { auctionRevision: 1 } },
            { session },
          ).exec();
          if (lock.matchedCount !== 1) {
            const existingSeason = await SeasonModel.findById(seasonId).select("status auctionLifecycleStatus").session(session).lean<{ status: string; auctionLifecycleStatus: string } | null>().exec();
            if (!existingSeason) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
            if (existingSeason.auctionLifecycleStatus !== "completed") {
              throw new AppError("Complete the auction and validate every team's roster before creating or changing fixtures.", 409, "AUCTION_NOT_COMPLETED");
            }
            throw new AppError("Fixtures cannot be changed after the season is completed or archived", 409, "SEASON_WRITE_LOCKED");
          }
        } else {
          const writableSeason = await SeasonModel.findById(seasonId).select("status")
            .session(session).lean<{ status: SeasonStatus } | null>().exec();
          if (!writableSeason) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
          if (!allowedStatuses.includes(writableSeason.status)) {
            throw new AppError("Completed or archived seasons are read-only", 409, "SEASON_WRITE_LOCKED");
          }
        }
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  private async assertPairRules(data: Pick<SeasonMatchFields, "seasonRef" | "stage" | "groupRef" | "roundNumber" | "homeSeasonTeamRef" | "awaySeasonTeamRef">, homeAndAway: boolean, excludeId: string | undefined, session: ClientSession): Promise<void> {
    const homeId = String(data.homeSeasonTeamRef), awayId = String(data.awaySeasonTeamRef);
    const matches = await SeasonMatchModel.find({
      seasonRef: data.seasonRef, stage: data.stage, groupRef: data.stage === "group" ? data.groupRef : null,
      $or: [
        { homeSeasonTeamRef: data.homeSeasonTeamRef, awaySeasonTeamRef: data.awaySeasonTeamRef },
        { homeSeasonTeamRef: data.awaySeasonTeamRef, awaySeasonTeamRef: data.homeSeasonTeamRef },
      ],
      ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}),
    }).session(session).lean<SeasonMatchEntity[]>().exec();
    const issue = getPairFixtureError(matches, data.roundNumber, homeId, awayId, homeAndAway, excludeId);
    if (issue === "DUPLICATE_PAIR_IN_ROUND") throw new AppError("These two teams already have a fixture in this round. Reversing home and away does not create a separate fixture.", 409, issue, { roundNumber: "This team pairing already exists in the selected round" });
    if (issue === "DUPLICATE_TEAM_PAIR") throw new AppError("This team pairing already has a fixture. Enable Home and Away Fixtures in season settings to schedule a return fixture.", 409, issue, { homeSeasonTeamRef: "This team pair already has a fixture" });
    if (issue === "PAIR_FIXTURE_LIMIT") throw new AppError("A team pair can have at most two fixtures in a home-and-away season", 409, issue);
    if (issue === "DUPLICATE_HOME_AWAY_ORIENTATION") throw new AppError("The return fixture must reverse the home and away teams.", 409, issue, { homeSeasonTeamRef: "Reverse the home and away teams for the return fixture" });
  }

  private async assertNoOtherLiveMatch(
    data: Pick<SeasonMatchFields, "seasonRef" | "homeSeasonTeamRef" | "awaySeasonTeamRef">,
    excludeId: string | undefined,
    session: ClientSession,
  ): Promise<void> {
    const requestedTeamIds = [String(data.homeSeasonTeamRef), String(data.awaySeasonTeamRef)];
    const liveFixtures = await SeasonMatchModel.find({
      seasonRef: data.seasonRef,
      status: "live",
      $or: [
        { homeSeasonTeamRef: { $in: [data.homeSeasonTeamRef, data.awaySeasonTeamRef] } },
        { awaySeasonTeamRef: { $in: [data.homeSeasonTeamRef, data.awaySeasonTeamRef] } },
      ],
      ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}),
    })
      .select("_id homeSeasonTeamRef awaySeasonTeamRef")
      .session(session)
      .lean<Array<Pick<SeasonMatchEntity, "_id" | "homeSeasonTeamRef" | "awaySeasonTeamRef">>>()
      .exec();

    const conflictingIds = getLiveMatchConflictingTeamIds(
      liveFixtures,
      requestedTeamIds[0],
      requestedTeamIds[1],
      excludeId,
    );
    if (!conflictingIds.length) return;

    const conflictingTeams = await SeasonTeamModel.find({
      _id: { $in: conflictingIds.map((id) => new Types.ObjectId(id)) },
    })
      .select("displayName")
      .session(session)
      .lean<Array<{ _id: Types.ObjectId; displayName: string }>>()
      .exec();
    const displayNameById = new Map(conflictingTeams.map((team) => [String(team._id), team.displayName]));
    const names = conflictingIds.map((id) => displayNameById.get(id) ?? "This team");

    throw new AppError(
      `${names.join(" and ")} already has another match ongoing. A team can only have one ongoing match at a time in a season.`,
      409,
      "TEAM_ALREADY_HAS_LIVE_MATCH",
      { teams: `${names.join(", ")} already has another ongoing match` },
    );
  }

  async create(data: SeasonMatchFields, homeAndAway: boolean): Promise<SeasonMatchEntity> {
    return this.withSeasonWriteLock(String(data.seasonRef), async (session) => {
      await this.assertPairRules(data, homeAndAway, undefined, session);
      if (data.status === "live") await this.assertNoOtherLiveMatch(data, undefined, session);
      const [doc] = await SeasonMatchModel.create([data], { session });
      return doc.toObject() as unknown as SeasonMatchEntity;
    });
  }

  async update(
    id: string,
    data: Partial<SeasonMatchFields>,
    homeAndAway: boolean,
    statusAudit?: { expectedStatus: SeasonMatchFields["status"]; entry: import("./seasonMatch.types.js").SeasonMatchStatusHistoryEntry; requireNoGoals?: boolean },
    options?: { requireEditableWithoutEvents?: boolean; requireAuctionCompleted?: boolean },
  ): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), async (session) => {
      const current = await SeasonMatchModel.findOne({ _id: new Types.ObjectId(id), seasonRef: existing.seasonRef }).session(session).lean<SeasonMatchEntity>().exec();
      if (!current) return null;

      if (options?.requireEditableWithoutEvents) {
        const currentWithCards = current as SeasonMatchEntity & { cards?: unknown[] };
        if (current.status !== "scheduled" && current.status !== "live") {
          throw new AppError("Only Scheduled or Live matches can be edited.", 409, "MATCH_DETAILS_EDIT_NOT_ALLOWED");
        }
        if ((current.goals ?? []).length > 0 || (currentWithCards.cards ?? []).length > 0) {
          throw new AppError("Match details cannot be edited after goals or cards have been recorded.", 409, "MATCH_HAS_EVENTS");
        }
      }

      if (statusAudit?.requireNoGoals && current.goals.length > 0) {
        throw new AppError(
          "Remove all recorded goal events before reverting this Live match to Scheduled.",
          409,
          "MATCH_HAS_GOALS",
          { goals: "Delete every recorded goal event first" },
        );
      }

      if (statusAudit) {
        if (current.status !== statusAudit.expectedStatus || statusAudit.entry.fromStatus !== current.status) {
          throw new AppError("This match status was changed by another update. Refresh the fixture and try again.", 409, "MATCH_STATUS_CONFLICT");
        }
        const history = current.statusHistory ?? [];
        const lastEntry = history[history.length - 1];
        if (lastEntry && lastEntry.toStatus !== current.status) {
          throw new AppError("The match status history is inconsistent with its current status. Further status changes are blocked.", 409, "MATCH_STATUS_HISTORY_CONFLICT");
        }
        if (statusAudit.entry.fromStatus === statusAudit.entry.toStatus) {
          throw new AppError("A status history entry must represent an actual status change.", 409, "DUPLICATE_MATCH_STATUS_HISTORY");
        }
        const expectedKickoff = statusAudit.entry.fromKickoffAt;
        if (expectedKickoff && current.kickoffAt.getTime() !== expectedKickoff.getTime()) {
          throw new AppError("This match kickoff was changed by another update. Refresh the fixture and try again.", 409, "MATCH_KICKOFF_CONFLICT");
        }
        const destinationKickoff = statusAudit.entry.toKickoffAt;
        if (destinationKickoff) {
          const requestedKickoff = data.kickoffAt ?? current.kickoffAt;
          if (requestedKickoff.getTime() !== destinationKickoff.getTime()) {
            throw new AppError("The recorded rescheduling time does not match the fixture update.", 409, "MATCH_KICKOFF_HISTORY_CONFLICT");
          }
        }
      }

      const fixtureCoreFields = ["kickoffAt", "homeSeasonTeamRef", "awaySeasonTeamRef", "stage", "groupRef", "roundNumber", "matchNumber", "venueRef", "matchDurationMinutes"] as const;
      if (current.actualStartedAt && fixtureCoreFields.some(field => data[field] !== undefined)) {
        throw new AppError("Core fixture fields are immutable after actual kickoff, including after postponement.", 409, "FIXTURE_LOCKED_AFTER_KICKOFF");
      }
      const next = { ...current, ...data };
      if (next.status === "live") await this.assertNoOtherLiveMatch(next, id, session);
      const pairChanged = String(next.homeSeasonTeamRef) !== String(current.homeSeasonTeamRef)
        || String(next.awaySeasonTeamRef) !== String(current.awaySeasonTeamRef)
        || next.stage !== current.stage
        || String(next.groupRef ?? "") !== String(current.groupRef ?? "")
        || next.roundNumber !== current.roundNumber;
      if (pairChanged) await this.assertPairRules(next, homeAndAway, id, session);

      const filter: any = {
        _id: new Types.ObjectId(id),
        seasonRef: existing.seasonRef,
        ...(options?.requireEditableWithoutEvents
          ? { status: statusAudit ? statusAudit.expectedStatus : { $in: ["scheduled", "live"] as SeasonMatchFields["status"][] } }
          : statusAudit ? { status: statusAudit.expectedStatus } : {}),
        ...(statusAudit?.requireNoGoals || options?.requireEditableWithoutEvents ? { goals: { $size: 0 } } : {}),
        ...(statusAudit?.requireNoGoals ? { $and: [{ $or: [{ cards: { $exists: false } }, { cards: { $size: 0 } }] }] } : {}),
        ...(options?.requireEditableWithoutEvents
          ? { $or: [{ cards: { $exists: false } }, { cards: { $size: 0 } }] }
          : {}),
      };
      const update: {
        $set: Partial<SeasonMatchFields>;
        $push?: { statusHistory: import("./seasonMatch.types.js").SeasonMatchStatusHistoryEntry };
      } = { $set: data };
      if (statusAudit) update.$push = { statusHistory: statusAudit.entry };

      const saved = await SeasonMatchModel.findOneAndUpdate(
        filter,
        update,
        { session, returnDocument: "after", runValidators: true },
      ).lean<SeasonMatchEntity>().exec();

      if (statusAudit && !saved) {
        throw new AppError("This match status was changed by another update. Refresh the fixture and try again.", 409, "MATCH_STATUS_CONFLICT");
      }
      return saved;
    }, false, options?.requireAuctionCompleted ?? true);
  }

  /**
   * Applies one operational transition with compare-and-set semantics. The session
   * and updatedAt predicate prevent two admins from overwriting clock/phase changes.
   * The optional season write lock serializes simultaneous kickoff attempts.
   */
  async applyOperationalUpdate(
    id: string,
    expectedUpdatedAt: Date,
    set: Partial<SeasonMatchFields>,
    auditEntry: MatchAuditHistoryEntry,
    options: { serializeSeasonStart?: boolean; requireAuctionCompleted?: boolean } = {},
  ): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;

    return this.withSeasonWriteLock(String(existing.seasonRef), async (session) => {
      if (options.serializeSeasonStart) {
        const seasonLock = await SeasonModel.updateOne(
          { _id: existing.seasonRef, status: { $in: ["upcoming", "active"] } },
          { $inc: { matchOperationRevision: 1 } },
          { session },
        ).exec();
        if (seasonLock.matchedCount !== 1) {
          const season = await SeasonModel.findById(existing.seasonRef).select("status").session(session)
            .lean<{ status: SeasonStatus } | null>().exec();
          if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
          throw new AppError("Completed or archived seasons are read-only", 409, "SEASON_WRITE_LOCKED");
        }
      }

      const current = await SeasonMatchModel.findOne({
        _id: new Types.ObjectId(id),
        seasonRef: existing.seasonRef,
        updatedAt: expectedUpdatedAt,
      }).session(session).lean<SeasonMatchEntity>().exec();
      if (!current) {
        const latest = await SeasonMatchModel.findById(id).session(session).select("_id").lean().exec();
        if (!latest) return null;
        throw new AppError("This Match changed during the operation. Refresh and try again.", 409, "MATCH_OPERATION_CONFLICT");
      }

      if (set.status === "live") {
        const next = { ...current, ...set };
        await this.assertNoOtherLiveMatch(next, id, session);
      }

      const push: { auditHistory: MatchAuditHistoryEntry; statusHistory?: SeasonMatchStatusHistoryEntry } = { auditHistory: auditEntry };
      if (set.status !== undefined && set.status !== current.status) {
        push.statusHistory = {
          fromStatus: current.status,
          toStatus: set.status,
          reason: auditEntry.reason,
          changedBy: auditEntry.actor,
          changedAt: auditEntry.timestamp,
          fromKickoffAt: current.kickoffAt,
          toKickoffAt: set.kickoffAt ?? current.kickoffAt,
        };
      }
      const saved = await SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef, updatedAt: expectedUpdatedAt },
        { $set: set, $push: push },
        { session, returnDocument: "after", runValidators: true },
      ).lean<SeasonMatchEntity>().exec();
      if (!saved) throw new AppError("This Match changed during the operation. Refresh and try again.", 409, "MATCH_OPERATION_CONFLICT");
      return saved;
    }, false, options.requireAuctionCompleted ?? false);
  }

  async correctCompletedMatch(id: string, expectedUpdatedAt: Date, goals: SeasonMatchFields["goals"], penaltyShootout: SeasonMatchFields["penaltyShootout"], winnerSeasonTeamRef: Types.ObjectId | null, historyEntry: import("./seasonMatch.types.js").SeasonMatchCorrectionHistoryEntry, auditEntry?: MatchAuditHistoryEntry, eventAuditEntries: MatchEventAuditHistoryEntry[] = []): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), async (session) => {
      const filter: any = { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef, status: "completed", updatedAt: expectedUpdatedAt };
      const current = await SeasonMatchModel.findOne(filter).session(session).lean<SeasonMatchEntity>().exec();
      if (!current) {
        const latest = await SeasonMatchModel.findById(id).session(session).select("status").lean<{ status: string }>().exec();
        if (!latest) return null;
        throw new AppError("This completed match changed while the correction was being prepared. Refresh and try again.", 409, "MATCH_CORRECTION_CONFLICT");
      }
      return SeasonMatchModel.findOneAndUpdate(filter, { $set: { goals, penaltyShootout, winnerSeasonTeamRef }, $push: {
        correctionHistory: historyEntry,
        ...(auditEntry ? { auditHistory: auditEntry } : {}),
        ...(eventAuditEntries.length ? { eventAuditHistory: { $each: eventAuditEntries } } : {}),
      } }, { session, returnDocument: "after", runValidators: true }).lean<SeasonMatchEntity>().exec();
    }, true, false);
  }

  async delete(id: string): Promise<boolean> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return false;
    return this.withSeasonWriteLock(String(existing.seasonRef), async (session) => {
      const current = await SeasonMatchModel.findOne({
        _id: new Types.ObjectId(id),
        seasonRef: existing.seasonRef,
      }).session(session).lean<SeasonMatchEntity>().exec();
      if (!current) return false;
      if (hasRecordedMatchIncidents(current)) {
        throw new AppError(
          "This match cannot be deleted because it contains recorded goals, cards or penalty-shootout events. Remove or preserve the incident history before deleting the fixture.",
          409,
          "MATCH_HAS_EVENTS",
        );
      }
      const result = await SeasonMatchModel.deleteOne({
        _id: new Types.ObjectId(id),
        seasonRef: existing.seasonRef,
        goals: { $size: 0 },
        $and: [
          { $or: [{ cards: { $exists: false } }, { cards: { $size: 0 } }] },
          { $or: [{ penaltyShootout: null }, { penaltyShootout: { $exists: false } }, { "penaltyShootout.kicks": { $size: 0 } }] },
          { $or: [{ correctionHistory: { $exists: false } }, { correctionHistory: { $size: 0 } }] },
        ],
      }).session(session).exec();
      if (result.deletedCount !== 1) {
        throw new AppError("This match changed while deletion was being processed. Refresh and check its incident history.", 409, "MATCH_DELETE_CONFLICT");
      }
      return true;
    });
  }


  async appendGoalWithWinner(id: string, goal: SeasonMatchFields["goals"][number], winnerSeasonTeamRef: Types.ObjectId | null, expectedUpdatedAt: Date, auditEntry: MatchEventAuditHistoryEntry): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), (session) =>
      SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef, status: "live", updatedAt: expectedUpdatedAt },
        { $push: { goals: goal, eventAuditHistory: auditEntry }, $set: { winnerSeasonTeamRef } },
        { session, returnDocument: "after", runValidators: true },
      ).lean<SeasonMatchEntity>().exec(),
      false, false);
  }

  async updateGoalWithWinner(id: string, goalId: string, goal: SeasonMatchFields["goals"][number], winnerSeasonTeamRef: Types.ObjectId | null, expectedUpdatedAt: Date, auditEntry: MatchEventAuditHistoryEntry): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), (session) =>
      SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef, status: "live", updatedAt: expectedUpdatedAt, "goals._id": new Types.ObjectId(goalId) },
        { $set: { "goals.$": goal, winnerSeasonTeamRef }, $push: { eventAuditHistory: auditEntry } },
        { session, returnDocument: "after", runValidators: true },
      ).lean<SeasonMatchEntity>().exec(),
      false, false);
  }

  async removeGoalWithWinner(id: string, goalId: string, winnerSeasonTeamRef: Types.ObjectId | null, expectedUpdatedAt: Date, auditEntry: MatchEventAuditHistoryEntry): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), (session) =>
      SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef, status: "live", updatedAt: expectedUpdatedAt, "goals._id": new Types.ObjectId(goalId) },
        { $pull: { goals: { _id: new Types.ObjectId(goalId) } }, $set: { winnerSeasonTeamRef }, $push: { eventAuditHistory: auditEntry } },
        { session, returnDocument: "after", runValidators: true },
      ).lean<SeasonMatchEntity>().exec(),
      false, false);
  }
  async appendGoal(id: string, goal: SeasonMatchFields["goals"][number]): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), (session) =>
      SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef },
        { $push: { goals: goal } },
        { session, returnDocument: "after", runValidators: true },
      ).lean<SeasonMatchEntity>().exec(),
      false, false);
  }

  async updateGoal(id: string, goalId: string, goal: SeasonMatchFields["goals"][number]): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), (session) =>
      SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef, "goals._id": new Types.ObjectId(goalId) },
        { $set: { "goals.$": goal } },
        { session, returnDocument: "after", runValidators: true },
      ).lean<SeasonMatchEntity>().exec(),
      false, false);
  }

  async removeGoal(id: string, goalId: string): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), (session) =>
      SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef },
        { $pull: { goals: { _id: new Types.ObjectId(goalId) } } },
        { session, returnDocument: "after" },
      ).lean<SeasonMatchEntity>().exec(),
      false, false);
  }
  async appendCard(id: string, card: import("./seasonMatch.types.js").SeasonMatchCardFields, expectedUpdatedAt: Date, auditEntry: MatchEventAuditHistoryEntry): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), (session) =>
      SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef, status: "live", updatedAt: expectedUpdatedAt },
        { $push: { cards: card, eventAuditHistory: auditEntry } },
        { session, returnDocument: "after", runValidators: true },
      ).lean<SeasonMatchEntity>().exec(), false, false);
  }

  async updateCard(id: string, cardId: string, card: import("./seasonMatch.types.js").SeasonMatchCardFields, expectedUpdatedAt: Date, auditEntry: MatchEventAuditHistoryEntry): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), (session) =>
      SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef, status: "live", updatedAt: expectedUpdatedAt, "cards._id": new Types.ObjectId(cardId) },
        { $set: { "cards.$": card }, $push: { eventAuditHistory: auditEntry } },
        { session, returnDocument: "after", runValidators: true },
      ).lean<SeasonMatchEntity>().exec(), false, false);
  }

  async removeCard(id: string, cardId: string, expectedUpdatedAt: Date, auditEntry: MatchEventAuditHistoryEntry): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), (session) =>
      SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef, status: "live", updatedAt: expectedUpdatedAt, "cards._id": new Types.ObjectId(cardId) },
        { $pull: { cards: { _id: new Types.ObjectId(cardId) } }, $push: { eventAuditHistory: auditEntry } },
        { session, returnDocument: "after" },
      ).lean<SeasonMatchEntity>().exec(), false, false);
  }

}
