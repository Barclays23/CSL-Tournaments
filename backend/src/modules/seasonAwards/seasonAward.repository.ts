import mongoose, { Types, type ClientSession } from "mongoose";
import { SeasonAwardModel } from "./seasonAward.model.js";
import type { SeasonAwardEntity, SeasonAwardFields, SeasonAwardType } from "./seasonAward.types.js";
import { SeasonModel } from "../seasons/season.model.js";
import { SeasonTeamModel } from "../seasonTeams/seasonTeam.model.js";
import { PlayerModel } from "../players/player.model.js";
import { AuctionLotModel } from "../auctionLots/auctionLot.model.js";
import { SeasonMatchModel } from "../matches/seasonMatch.model.js";
import type { SeasonTeamEntity } from "../seasonTeams/seasonTeam.types.js";
import type { Asset } from "../../shared/types/common.types.js";

type PopulatedAwardTeam = Omit<SeasonTeamEntity, "teamRef"> & {
  teamRef: Types.ObjectId | { _id: Types.ObjectId; name: string; logo: Asset | null };
};

export class SeasonAwardRepository {
  async getAwardReadinessSnapshot(seasonId: string) {
    const seasonRef = new Types.ObjectId(seasonId);
    const [matches, seasonTeams, pendingAuctionLots] = await Promise.all([
      SeasonMatchModel.find({ seasonRef }).select("matchNumber stage status homeSeasonTeamRef awaySeasonTeamRef winnerSeasonTeamRef resolutionHistory").lean().exec(),
      SeasonTeamModel.find({ seasonRef }).select("_id").lean<Array<{ _id: Types.ObjectId }>>().exec(),
      AuctionLotModel.countDocuments({ seasonRef, auctionStatus: "pending" }).exec(),
    ]);
    return { matches, seasonTeamIds: seasonTeams.map((team) => team._id), pendingAuctionLots };
  }

  async findSeasonStatus(seasonId: string): Promise<string | null> {
    const season = await SeasonModel.findById(seasonId).select("status").lean<{ status: string }>().exec();
    return season?.status ?? null;
  }

  async findBySeason(seasonId: string): Promise<SeasonAwardEntity[]> {
    return SeasonAwardModel.find({ seasonRef: new Types.ObjectId(seasonId) })
      .populate({
        path: "recipients.seasonTeamRef",
        select: "displayName logoSnapshot teamRef",
        populate: { path: "teamRef", select: "name logo" },
      })
      .sort({ awardType: 1, createdAt: 1 }).lean<SeasonAwardEntity[]>().exec();
  }

  async findByIdInSeason(seasonId: string, awardId: string): Promise<SeasonAwardEntity | null> {
    return SeasonAwardModel.findOne({ _id: new Types.ObjectId(awardId), seasonRef: new Types.ObjectId(seasonId) })
      .lean<SeasonAwardEntity>().exec();
  }

  async findAwardTypeInSeason(seasonId: string, awardType: SeasonAwardType, session?: ClientSession): Promise<SeasonAwardEntity | null> {
    return SeasonAwardModel.findOne({ seasonRef: new Types.ObjectId(seasonId), awardType })
      .session(session ?? null).lean<SeasonAwardEntity>().exec();
  }

  async findSeasonTeam(seasonId: string, seasonTeamId: string): Promise<PopulatedAwardTeam | null> {
    return SeasonTeamModel.findOne({
      _id: new Types.ObjectId(seasonTeamId),
      seasonRef: new Types.ObjectId(seasonId),
    }).populate({ path: "teamRef", select: "name logo" }).lean<PopulatedAwardTeam | null>().exec();
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
