import { Types } from "mongoose";
import type { ClientSession } from "mongoose";
import { SeasonModel } from "../seasons/season.model.js";
import { ManagerModel } from "../managers/manager.model.js";
import { GroupModel } from "../groups/group.model.js";
import { AuctionLotModel } from "../auctionLots/auctionLot.model.js";
import { SeasonMatchModel } from "../matches/seasonMatch.model.js";
import { SeasonTeamModel } from "./seasonTeam.model.js";
import type { SeasonTeamEntity, SeasonTeamFields } from "./seasonTeam.types.js";
import type { SeasonStatus } from "../seasons/season.types.js";

export class SeasonTeamRepository {
  async findBySeason(seasonId: string, session?: ClientSession): Promise<SeasonTeamEntity[]> {
    return SeasonTeamModel.find({ seasonRef: new Types.ObjectId(seasonId) })
      .sort({ displayName: 1 }).session(session ?? null).lean<SeasonTeamEntity[]>().exec();
  }

  async findById(id: string, session?: ClientSession): Promise<SeasonTeamEntity | null> {
    return SeasonTeamModel.findById(id).session(session ?? null).lean<SeasonTeamEntity>().exec();
  }

  async countBySeason(seasonId: string, session?: ClientSession): Promise<number> {
    return SeasonTeamModel.countDocuments({ seasonRef: new Types.ObjectId(seasonId) }).session(session ?? null).exec();
  }

  async createMany(records: SeasonTeamFields[], session?: ClientSession): Promise<SeasonTeamEntity[]> {
    if (!records.length) return [];
    const created = await SeasonTeamModel.insertMany(records, { session, ordered: true });
    return created.map((item) => item.toObject() as unknown as SeasonTeamEntity);
  }

  async updateStatus(id: string, status: SeasonTeamFields["status"]): Promise<SeasonTeamEntity | null> {
    return SeasonTeamModel.findByIdAndUpdate(id, { $set: { status } }, {
      returnDocument: "after", runValidators: true,
    }).lean<SeasonTeamEntity>().exec();
  }

  async findSeasonState(seasonId: string, session?: ClientSession): Promise<{ _id: Types.ObjectId; status: string; groupStageEnabled: boolean } | null> {
    return SeasonModel.findById(seasonId).select("_id status groupStageEnabled").session(session ?? null)
      .lean<{ _id: Types.ObjectId; status: string; groupStageEnabled: boolean }>().exec();
  }

  async lockSeason(seasonId: string, statuses: SeasonStatus[], session: ClientSession): Promise<boolean> {
    const result = await SeasonModel.updateOne(
      { _id: new Types.ObjectId(seasonId), status: { $in: statuses } },
      { $inc: { auctionRevision: 1 } }, { session },
    ).exec();
    return result.matchedCount === 1;
  }

  async findPopulatedBySeason(seasonId: string): Promise<any[]> {
    return SeasonTeamModel.find({ seasonRef: new Types.ObjectId(seasonId) }).sort({ displayName: 1 })
      .populate({ path: "teamRef", select: "name shortName logo" })
      .populate({ path: "groupRef", select: "groupName displayOrder" })
      .populate({ path: "managerRefs", select: "name role profilePic" }).lean().exec();
  }

  async findPopulatedInSeason(seasonId: string, id: string): Promise<any | null> {
    return SeasonTeamModel.findOne({ _id: new Types.ObjectId(id), seasonRef: new Types.ObjectId(seasonId) })
      .populate({ path: "teamRef", select: "name shortName logo" })
      .populate({ path: "groupRef", select: "groupName displayOrder" })
      .populate({ path: "managerRefs", select: "name role profilePic" }).lean().exec();
  }

  async findInSeason(seasonId: string, id: string, session?: ClientSession): Promise<any | null> {
    return SeasonTeamModel.findOne({ _id: new Types.ObjectId(id), seasonRef: new Types.ObjectId(seasonId) })
      .session(session ?? null).lean().exec();
  }

  async countActiveManagers(ids: Types.ObjectId[], session?: ClientSession): Promise<number> {
    return ManagerModel.countDocuments({ _id: { $in: ids }, status: "active" }).session(session ?? null).exec();
  }

  async countFixtures(seasonId: string, session?: ClientSession): Promise<number> {
    return SeasonMatchModel.countDocuments({ seasonRef: new Types.ObjectId(seasonId) }).session(session ?? null).exec();
  }

  async findGroupInSeason(seasonId: string, groupId: string, session?: ClientSession): Promise<any | null> {
    return GroupModel.findOne({ _id: new Types.ObjectId(groupId), seasonRef: new Types.ObjectId(seasonId) })
      .session(session ?? null).lean().exec();
  }

  async countTeamLots(seasonId: string, seasonTeamId: string, session?: ClientSession): Promise<number> {
    return AuctionLotModel.countDocuments({
      seasonRef: new Types.ObjectId(seasonId), seasonTeamRef: new Types.ObjectId(seasonTeamId),
    }).session(session ?? null).exec();
  }

  async countTeamFixtures(seasonId: string, seasonTeamId: string, session?: ClientSession): Promise<number> {
    const teamRef = new Types.ObjectId(seasonTeamId);
    return SeasonMatchModel.countDocuments({
      seasonRef: new Types.ObjectId(seasonId),
      $or: [{ homeSeasonTeamRef: teamRef }, { awaySeasonTeamRef: teamRef }],
    }).session(session ?? null).exec();
  }

  async findUnresolvedTeamFixtures(seasonId: string, seasonTeamId: string, session?: ClientSession): Promise<Array<{ matchNumber: number; status: string; resolutionHistory?: Array<{ status: string; reason: string; decidedAt: Date }> }>> {
    const teamRef = new Types.ObjectId(seasonTeamId);
    return SeasonMatchModel.find({
      seasonRef: new Types.ObjectId(seasonId),
      $or: [{ homeSeasonTeamRef: teamRef }, { awaySeasonTeamRef: teamRef }],
    }).select("matchNumber status resolutionHistory").session(session ?? null)
      .lean<Array<{ matchNumber: number; status: string; resolutionHistory?: Array<{ status: string; reason: string; decidedAt: Date }> }>>().exec();
  }

  async recallInSeason(seasonId: string, id: string, reason: string, session: ClientSession): Promise<boolean> {
    const result = await SeasonTeamModel.updateOne(
      { _id: new Types.ObjectId(id), seasonRef: new Types.ObjectId(seasonId), status: "withdrawn" },
      { $set: { status: "active" }, $push: { participationHistory: { fromStatus: "withdrawn", toStatus: "active", reason, changedAt: new Date() } } },
      { session, runValidators: true },
    ).exec();
    return result.modifiedCount === 1;
  }

  async updateInSeason(seasonId: string, id: string, patch: Record<string, unknown>, session?: ClientSession): Promise<any | null> {
    return SeasonTeamModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), seasonRef: new Types.ObjectId(seasonId) },
      { $set: patch }, { session, returnDocument: "after", runValidators: true },
    ).lean().exec();
  }

  async deleteInSeason(seasonId: string, id: string, session?: ClientSession): Promise<boolean> {
    const result = await SeasonTeamModel.deleteOne({
      _id: new Types.ObjectId(id), seasonRef: new Types.ObjectId(seasonId),
    }).session(session ?? null).exec();
    return result.deletedCount === 1;
  }
}
