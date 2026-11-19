import mongoose, { Types } from "mongoose";
import type { ClientSession } from "mongoose";
import type { SeasonMatchFields, SeasonMatchEntity, SeasonMatchListFilter, PopulatedSeasonMatch } from "./seasonMatch.types.js";
import { SeasonMatchModel } from "./seasonMatch.model.js";
import { SeasonModel } from "../seasons/season.model.js";
import { SeasonTeamModel } from "../seasonTeams/seasonTeam.model.js";
import { GroupModel } from "../groups/group.model.js";
import { PlayerModel } from "../players/player.model.js";
import { AuctionLotModel } from "../auctionLots/auctionLot.model.js";
import type { SeasonEntity } from "../seasons/season.types.js";
import type { SeasonTeamEntity } from "../seasonTeams/seasonTeam.types.js";
import type { PlayerEntity } from "../players/player.types.js";
import type { AuctionLotEntity } from "../auctionLots/auctionLot.types.js";
import { AppError } from "../../shared/errors/appError.js";
import { getLiveMatchConflictingTeamIds, getPairFixtureError } from "./seasonMatch.fixtureRules.js";

const population = [
  { path: "homeSeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "awaySeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "winnerSeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "goals.scoringSeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "goals.playerSeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "goals.scorerPlayerRef", select: "name profilePic" },
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
   * Serialize every fixture write against SeasonRepository.completeIfReady().
   * Both operations write the same Season document in the same transaction, so
   * MongoDB's transaction conflict detection prevents completion from observing
   * a fixture snapshot that is concurrently being changed.
   */
  private async withSeasonWriteLock<T>(seasonId: string, work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        const lock = await SeasonModel.updateOne(
          { _id: new Types.ObjectId(seasonId), status: { $in: ["upcoming", "active"] } },
          { $inc: { auctionRevision: 1 } },
          { session },
        ).exec();
        if (lock.matchedCount !== 1) {
          const exists = await SeasonModel.exists({ _id: new Types.ObjectId(seasonId) }).session(session);
          if (!exists) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
          throw new AppError("Fixtures cannot be changed after the season is completed or archived", 409, "SEASON_WRITE_LOCKED");
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
    options?: { requireEditableWithoutEvents?: boolean },
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

      const next = { ...current, ...data };
      if (next.status === "live") await this.assertNoOtherLiveMatch(next, id, session);
      const pairChanged = String(next.homeSeasonTeamRef) !== String(current.homeSeasonTeamRef)
        || String(next.awaySeasonTeamRef) !== String(current.awaySeasonTeamRef)
        || next.stage !== current.stage
        || String(next.groupRef ?? "") !== String(current.groupRef ?? "")
        || next.roundNumber !== current.roundNumber;
      if (pairChanged) await this.assertPairRules(next, homeAndAway, id, session);

      const filter = {
        _id: new Types.ObjectId(id),
        seasonRef: existing.seasonRef,
        ...(options?.requireEditableWithoutEvents
          ? { status: statusAudit ? statusAudit.expectedStatus : { $in: ["scheduled", "live"] } }
          : statusAudit ? { status: statusAudit.expectedStatus } : {}),
        ...(statusAudit?.requireNoGoals || options?.requireEditableWithoutEvents ? { goals: { $size: 0 } } : {}),
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
    });
  }

  async delete(id: string): Promise<boolean> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return false;
    return this.withSeasonWriteLock(String(existing.seasonRef), async (session) => {
      const result = await SeasonMatchModel.deleteOne({ _id: new Types.ObjectId(id), seasonRef: existing.seasonRef }).session(session).exec();
      return result.deletedCount === 1;
    });
  }


  async appendGoalWithWinner(id: string, goal: SeasonMatchFields["goals"][number], winnerSeasonTeamRef: Types.ObjectId | null): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), (session) =>
      SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef, status: "live" },
        { $push: { goals: goal }, $set: { winnerSeasonTeamRef } },
        { session, returnDocument: "after", runValidators: true },
      ).lean<SeasonMatchEntity>().exec(),
    );
  }

  async updateGoalWithWinner(id: string, goalId: string, goal: SeasonMatchFields["goals"][number], winnerSeasonTeamRef: Types.ObjectId | null): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), (session) =>
      SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef, status: "live", "goals._id": new Types.ObjectId(goalId) },
        { $set: { "goals.$": goal, winnerSeasonTeamRef } },
        { session, returnDocument: "after", runValidators: true },
      ).lean<SeasonMatchEntity>().exec(),
    );
  }

  async removeGoalWithWinner(id: string, goalId: string, winnerSeasonTeamRef: Types.ObjectId | null): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), (session) =>
      SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef, status: "live" },
        { $pull: { goals: { _id: new Types.ObjectId(goalId) } }, $set: { winnerSeasonTeamRef } },
        { session, returnDocument: "after" },
      ).lean<SeasonMatchEntity>().exec(),
    );
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
    );
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
    );
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
    );
  }
}
