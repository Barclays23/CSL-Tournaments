import mongoose, { Types, type ClientSession } from "mongoose";
import { SeasonAwardModel } from "./seasonAward.model.js";
import type { SeasonAwardEntity, SeasonAwardFields } from "./seasonAward.types.js";
import { SeasonModel } from "../seasons/season.model.js";
import { SeasonTeamModel } from "../seasonTeams/seasonTeam.model.js";
import { PlayerModel } from "../players/player.model.js";
import { AuctionLotModel } from "../auctionLots/auctionLot.model.js";

export class SeasonAwardRepository {
  async findSeasonStatus(seasonId: string): Promise<string | null> {
    const season = await SeasonModel.findById(seasonId).select("status").lean<{ status: string }>().exec();
    return season?.status ?? null;
  }

  async findBySeason(seasonId: string): Promise<SeasonAwardEntity[]> {
    return SeasonAwardModel.find({ seasonRef: new Types.ObjectId(seasonId) })
      .sort({ awardType: 1, createdAt: 1 }).lean<SeasonAwardEntity[]>().exec();
  }

  async findByIdInSeason(seasonId: string, awardId: string): Promise<SeasonAwardEntity | null> {
    return SeasonAwardModel.findOne({ _id: new Types.ObjectId(awardId), seasonRef: new Types.ObjectId(seasonId) })
      .lean<SeasonAwardEntity>().exec();
  }

  async findAwardTypeInSeason(seasonId: string, awardType: string, session?: ClientSession): Promise<SeasonAwardEntity | null> {
    return SeasonAwardModel.findOne({ seasonRef: new Types.ObjectId(seasonId), awardType })
      .session(session ?? null).lean<SeasonAwardEntity>().exec();
  }

  async findSeasonTeam(seasonId: string, seasonTeamId: string) {
    return SeasonTeamModel.findOne({
      _id: new Types.ObjectId(seasonTeamId),
      seasonRef: new Types.ObjectId(seasonId),
    }).lean().exec();
  }

  async findPlayerForSeasonTeam(seasonId: string, seasonTeamId: string, playerId: string) {
    const [player, lot] = await Promise.all([
      PlayerModel.findById(playerId).lean().exec(),
      AuctionLotModel.findOne({
        seasonRef: new Types.ObjectId(seasonId),
        seasonTeamRef: new Types.ObjectId(seasonTeamId),
        playerRef: new Types.ObjectId(playerId),
        auctionStatus: "sold",
      }).lean().exec(),
    ]);
    return player && lot ? player : null;
  }

  async createWhileActive(seasonId: string, data: SeasonAwardFields): Promise<SeasonAwardEntity> {
    return this.withActiveSeasonLock(seasonId, async (session) => {
      const [created] = await SeasonAwardModel.create([data], { session });
      return created.toObject() as unknown as SeasonAwardEntity;
    });
  }

  async updateWhileActive(seasonId: string, awardId: string, data: Partial<SeasonAwardFields>): Promise<SeasonAwardEntity | null> {
    return this.withActiveSeasonLock(seasonId, async (session) => {
      return SeasonAwardModel.findOneAndUpdate(
        { _id: new Types.ObjectId(awardId), seasonRef: new Types.ObjectId(seasonId) },
        { $set: data },
        { session, returnDocument: "after", runValidators: true },
      ).lean<SeasonAwardEntity>().exec();
    });
  }

  async deleteWhileActive(seasonId: string, awardId: string): Promise<boolean> {
    return this.withActiveSeasonLock(seasonId, async (session) => {
      const result = await SeasonAwardModel.deleteOne({
        _id: new Types.ObjectId(awardId),
        seasonRef: new Types.ObjectId(seasonId),
      }).session(session).exec();
      return result.deletedCount === 1;
    });
  }

  private async withActiveSeasonLock<T>(seasonId: string, operation: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
      let value: T | undefined;
      await session.withTransaction(async () => {
        const lock = await SeasonModel.updateOne(
          { _id: new Types.ObjectId(seasonId), status: "active" },
          { $inc: { auctionRevision: 1 } },
          { session },
        ).exec();
        if (lock.matchedCount !== 1) throw new Error("SEASON_AWARDS_LOCKED");
        value = await operation(session);
      });
      if (value === undefined) throw new Error("Season award transaction returned no result");
      return value;
    } finally {
      await session.endSession();
    }
  }
}
