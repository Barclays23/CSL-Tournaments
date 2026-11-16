import mongoose, { Types } from "mongoose";
import { GroupModel } from "./group.model.js";
import type { GroupEntity, GroupFields } from "./group.types.js";
import type { IGroupRepository } from "./group.interfaces.js";
import { SeasonModel } from "../seasons/season.model.js";
import { SeasonTeamModel } from "../seasonTeams/seasonTeam.model.js";
import { SeasonMatchModel } from "../matches/seasonMatch.model.js";
import type { SeasonStatus } from "../seasons/season.types.js";

export function normalizeGroupName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export class GroupRepository implements IGroupRepository {
  async findBySeason(seasonId: string): Promise<GroupEntity[]> {
    return GroupModel.find({ seasonRef: new Types.ObjectId(seasonId) })
      .sort({ displayOrder: 1, groupName: 1 })
      .lean<GroupEntity[]>()
      .exec();
  }

  async getSeasonState(seasonId: string): Promise<{ status: SeasonStatus; groupStageEnabled: boolean } | null> {
    return SeasonModel.findById(seasonId)
      .select("status groupStageEnabled")
      .lean<{ status: SeasonStatus; groupStageEnabled: boolean }>()
      .exec();
  }

  async countSeasonTeams(seasonId: string): Promise<number> {
    return SeasonTeamModel.countDocuments({ seasonRef: new Types.ObjectId(seasonId) }).exec();
  }

  async countFixtures(seasonId: string): Promise<number> {
    return SeasonMatchModel.countDocuments({ seasonRef: new Types.ObjectId(seasonId) }).exec();
  }

  async findByName(seasonId: string, name: string): Promise<GroupEntity | null> {
    return GroupModel.findOne({
      seasonRef: new Types.ObjectId(seasonId),
      normalizedGroupName: normalizeGroupName(name),
    }).lean<GroupEntity>().exec();
  }

  async findInSeason(seasonId: string, groupId: string): Promise<GroupEntity | null> {
    return GroupModel.findOne({
      _id: new Types.ObjectId(groupId),
      seasonRef: new Types.ObjectId(seasonId),
    }).lean<GroupEntity>().exec();
  }

  async countMatchReferences(seasonId: string, groupId: string): Promise<number> {
    return SeasonMatchModel.countDocuments({
      seasonRef: new Types.ObjectId(seasonId),
      groupRef: new Types.ObjectId(groupId),
    }).exec();
  }

  async countAssignments(seasonId: string, groupId: string): Promise<number> {
    const groupRef = new Types.ObjectId(groupId);
    return SeasonTeamModel.countDocuments({
      seasonRef: new Types.ObjectId(seasonId),
      groupRef,
    }).exec();
  }

  async create(data: GroupFields): Promise<GroupEntity> {
    const session = await mongoose.startSession();
    try {
      let created: GroupEntity | null = null;
      await session.withTransaction(async () => {
        // Group creation participates in the season revision lock used by
        // completion and empty-season deletion.
        const lock = await SeasonModel.updateOne(
          { _id: data.seasonRef, status: { $in: ["draft", "upcoming"] } },
          { $inc: { auctionRevision: 1 } },
          { session },
        ).exec();
        if (lock.matchedCount !== 1) throw new Error("SEASON_GROUP_WRITE_LOCKED");
        const [record] = await GroupModel.create([{
          ...data,
          groupName: data.groupName.trim(),
          normalizedGroupName: normalizeGroupName(data.groupName),
        }], { session });
        created = record.toObject() as unknown as GroupEntity;
      });
      if (!created) throw new Error("Group creation transaction returned no document");
      return created;
    } finally {
      await session.endSession();
    }
  }

  async updateInSeason(
    seasonId: string,
    groupId: string,
    data: Partial<Pick<GroupFields, "groupName" | "displayOrder">>,
  ): Promise<GroupEntity | null> {
    const patch = {
      ...data,
      ...(data.groupName !== undefined
        ? { groupName: data.groupName.trim(), normalizedGroupName: normalizeGroupName(data.groupName) }
        : {}),
    };
    return GroupModel.findOneAndUpdate(
      { _id: new Types.ObjectId(groupId), seasonRef: new Types.ObjectId(seasonId) },
      { $set: patch },
      { returnDocument: "after", runValidators: true },
    ).lean<GroupEntity>().exec();
  }

  async deleteInSeason(seasonId: string, groupId: string): Promise<boolean> {
    const result = await GroupModel.deleteOne({
      _id: new Types.ObjectId(groupId),
      seasonRef: new Types.ObjectId(seasonId),
    }).exec();
    return result.deletedCount === 1;
  }
}
