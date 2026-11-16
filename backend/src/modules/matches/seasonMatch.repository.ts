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

const population = [
  { path: "homeSeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "awaySeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "winnerSeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "goals.scoringSeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "goals.playerSeasonTeamRef", select: "displayName logoSnapshot teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "goals.scorerPlayerRef", select: "name profilePic" },
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
  async findPopulatedById(id: string): Promise<PopulatedSeasonMatch | null> { return SeasonMatchModel.findById(id).populate(population).lean<PopulatedSeasonMatch>().exec(); }
  async findByNumber(seasonId: string, number: number): Promise<SeasonMatchEntity | null> { return SeasonMatchModel.findOne({ seasonRef: new Types.ObjectId(seasonId), matchNumber: number }).lean<SeasonMatchEntity>().exec(); }
  async findSeason(id: string): Promise<SeasonEntity | null> { return SeasonModel.findById(id).lean<SeasonEntity>().exec(); }
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

  async create(data: SeasonMatchFields): Promise<SeasonMatchEntity> {
    return this.withSeasonWriteLock(String(data.seasonRef), async (session) => {
      const [doc] = await SeasonMatchModel.create([data], { session });
      return doc.toObject() as unknown as SeasonMatchEntity;
    });
  }

  async update(id: string, data: Partial<SeasonMatchFields>): Promise<SeasonMatchEntity | null> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return null;
    return this.withSeasonWriteLock(String(existing.seasonRef), (session) =>
      SeasonMatchModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), seasonRef: existing.seasonRef },
        { $set: data },
        { session, returnDocument: "after", runValidators: true },
      ).lean<SeasonMatchEntity>().exec(),
    );
  }

  async delete(id: string): Promise<boolean> {
    const existing = await SeasonMatchModel.findById(id).select("seasonRef").lean<{ seasonRef: Types.ObjectId }>().exec();
    if (!existing) return false;
    return this.withSeasonWriteLock(String(existing.seasonRef), async (session) => {
      const result = await SeasonMatchModel.deleteOne({ _id: new Types.ObjectId(id), seasonRef: existing.seasonRef }).session(session).exec();
      return result.deletedCount === 1;
    });
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
