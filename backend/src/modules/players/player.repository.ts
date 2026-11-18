import mongoose, { Types, type QueryFilter } from "mongoose";
import { SeasonMatchModel } from "../matches/seasonMatch.model.js";
import { AuctionLotModel } from "../auctionLots/auctionLot.model.js";
import { SeasonAwardModel } from "../seasonAwards/seasonAward.model.js";
import { PlayerModel } from "./player.model.js";
import type { PlayerRecord } from "./player.model.js";
import type { IPlayerRepository } from "./player.interfaces.js";
import type { PlayerEntity, PlayerFields, PlayerListFilter } from "./player.types.js";

export class PlayerRepository implements IPlayerRepository {
  async findPlayers(filter: PlayerListFilter, page: number, limit: number): Promise<{ items: PlayerEntity[]; total: number }> {
    const mongoFilter: QueryFilter<PlayerRecord> = filter;
    const [items, total] = await Promise.all([
      PlayerModel.find(mongoFilter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean<PlayerEntity[]>().exec(),
      PlayerModel.countDocuments(mongoFilter).exec(),
    ]);
    return { items, total };
  }

  async findPlayerById(playerId: string): Promise<PlayerEntity | null> {
    return PlayerModel.findById(playerId).lean<PlayerEntity>().exec();
  }
  async findPlayerByMobile(mobile: string): Promise<PlayerEntity | null> {
    return PlayerModel.findOne({ mobile }).lean<PlayerEntity>().exec();
  }
  async findPlayerByEmail(email: string): Promise<PlayerEntity | null> {
    return PlayerModel.findOne({ email }).lean<PlayerEntity>().exec();
  }

  async countPlayerReferences(playerId: string) {
    const id = new Types.ObjectId(playerId);
    const [auctionLots, seasonMatches, legacyMatches, awards] = await Promise.all([
      AuctionLotModel.countDocuments({ playerRef: id }).exec(),
      SeasonMatchModel.countDocuments({ $or: [
        { "goals.scorerPlayerRef": id },
        { "penaltyShootout.kicks.playerRef": id },
      ] }).exec(),
      SeasonMatchModel.countDocuments({ $or: [
        { "goals.scorerRef": id },
        { "goals.ownGoalPlayerRef": id },
      ] }).exec(),
      SeasonAwardModel.countDocuments({ "recipients.playerRef": id }).exec(),
    ]);
    return { auctionLots, seasonMatches, legacyMatches, awards };
  }

  async createPlayer(data: PlayerFields): Promise<PlayerEntity> {
    const created = await PlayerModel.create(data);
    const saved = await this.findPlayerById(String(created._id));
    if (!saved) throw new Error("Created player could not be retrieved");
    return saved;
  }

  async updatePlayer(playerId: string, data: Partial<PlayerFields>): Promise<PlayerEntity | null> {
    return PlayerModel.findByIdAndUpdate(playerId, { $set: data }, {
      returnDocument: "after", runValidators: true, strict: "throw",
    }).lean<PlayerEntity>().exec();
  }

  async deletePlayerIfUnreferenced(playerId: string): Promise<boolean> {
    const session = await mongoose.startSession();
    let deleted = false;
    try {
      await session.withTransaction(async () => {
        const id = new Types.ObjectId(playerId);
        const [auctionLots, seasonMatches, legacyMatches, awards] = await Promise.all([
          AuctionLotModel.countDocuments({ playerRef: id }).session(session).exec(),
          SeasonMatchModel.countDocuments({ $or: [
            { "goals.scorerPlayerRef": id },
            { "penaltyShootout.kicks.playerRef": id },
          ] }).session(session).exec(),
          SeasonMatchModel.countDocuments({ $or: [
            { "goals.scorerRef": id },
            { "goals.ownGoalPlayerRef": id },
          ] }).session(session).exec(),
          SeasonAwardModel.countDocuments({ "recipients.playerRef": id }).session(session).exec(),
        ]);
        if (auctionLots + seasonMatches + legacyMatches + awards > 0) return;
        const result = await PlayerModel.deleteOne({ _id: id }).session(session).exec();
        deleted = result.deletedCount === 1;
      });
    } finally {
      await session.endSession();
    }
    return deleted;
  }
}
