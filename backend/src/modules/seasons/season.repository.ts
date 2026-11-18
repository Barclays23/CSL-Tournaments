import mongoose, { Types } from "mongoose";
import { SeasonModel } from "./season.model.js";
import type { ISeasonRepository, SeasonGroupReadiness } from "./season.interfaces.js";
import type { SeasonEntity, SeasonFields, SeasonListFilter, SeasonStatus } from "./season.types.js";
import { SeasonTeamModel } from "../seasonTeams/seasonTeam.model.js";
import { GroupModel } from "../groups/group.model.js";
import { AuctionLotModel } from "../auctionLots/auctionLot.model.js";
import { SeasonMatchModel } from "../matches/seasonMatch.model.js";
import { TeamModel } from "../teams/team.model.js";
import { SeasonAwardModel } from "../seasonAwards/seasonAward.model.js";
import { getSeasonCompletionBlockers } from "./season.completion.js";
import type { CreateSeasonDto } from "./season.dto.js";
import type { SeasonTeamEntity, SeasonTeamFields } from "../seasonTeams/seasonTeam.types.js";
import type { SeasonMatchEntity } from "../matches/seasonMatch.types.js";

export class SeasonRepository implements ISeasonRepository {
  async findSeasons(filter: SeasonListFilter): Promise<SeasonEntity[]> {
    return SeasonModel.find(filter).sort({ year: -1, seasonNumber: -1 }).lean<SeasonEntity[]>().exec();
  }

  async findById(id: string): Promise<SeasonEntity | null> {
    return SeasonModel.findById(id).lean<SeasonEntity>().exec();
  }

  async findByNumber(number: number, excludeId?: string): Promise<SeasonEntity | null> {
    return SeasonModel.findOne({ seasonNumber: number, ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}) }).lean<SeasonEntity>().exec();
  }

  async findByNormalizedName(name: string, excludeId?: string): Promise<SeasonEntity | null> {
    return SeasonModel.findOne({ normalizedName: name, ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}) }).lean<SeasonEntity>().exec();
  }

  async findActive(excludeId?: string): Promise<SeasonEntity | null> {
    return SeasonModel.findOne({ status: "active", ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}) }).lean<SeasonEntity>().exec();
  }

  async createSeason(data: CreateSeasonDto, normalizedName: string): Promise<SeasonEntity> {
    const created = await SeasonModel.create({
      seasonNumber: data.seasonNumber,
      name: data.name.trim(),
      normalizedName,
      year: data.year,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      timeZone: data.timeZone ?? "Asia/Kolkata",
      groupStageEnabled: data.groupStageEnabled ?? true,
      homeAndAwayFixtures: data.homeAndAwayFixtures ?? false,
      status: "draft",
      historyCompleteness: "not_applicable",
      auctionSettings: data.auctionSettings,
      pointsRules: data.pointsRules ?? { win: 3, draw: 1, loss: 0 },
      standingsTieBreakers: data.standingsTieBreakers ?? ["points", "goalDifference", "goalsScored", "teamNameAsc"],
      matchRules: data.matchRules ?? {
        groupStageDrawAllowed: true,
        knockoutDrawRequiresShootout: true,
        shootoutCountsForMatchScore: false,
        shootoutCountsForPlayerGoals: false,
      },
    });
    return created.toObject() as unknown as SeasonEntity;
  }

  async update(id: string, data: Partial<SeasonFields>): Promise<SeasonEntity | null> {
    return SeasonModel.findByIdAndUpdate(id, { $set: data }, {
      returnDocument: "after",
      runValidators: true,
    }).lean<SeasonEntity>().exec();
  }

  async updateStatus(id: string, current: SeasonStatus, next: SeasonStatus): Promise<SeasonEntity | null> {
    return SeasonModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), status: current },
      { $set: { status: next } },
      { returnDocument: "after", runValidators: true },
    ).lean<SeasonEntity>().exec();
  }

  async completeIfReady(seasonId: string): Promise<{ season: SeasonEntity | null; blockers: string[] }> {
    const session = await mongoose.startSession();
    try {
      let result: { season: SeasonEntity | null; blockers: string[] } = { season: null, blockers: [] };
      await session.withTransaction(async () => {
        const season = await SeasonModel.findOne({ _id: new Types.ObjectId(seasonId), status: "active" }).session(session).lean<SeasonEntity>().exec();
        if (!season) { result = { season: null, blockers: [] }; return; }
        await SeasonModel.updateOne({ _id: season._id, status: "active" }, { $inc: { auctionRevision: 1 } }, { session }).exec();
        const [matches, seasonTeams, awards, pendingAuctionLots] = await Promise.all([
          SeasonMatchModel.find({ seasonRef: season._id }).session(session).lean().exec(),
          SeasonTeamModel.find({ seasonRef: season._id }).select("_id status").session(session).lean().exec(),
          SeasonAwardModel.find({ seasonRef: season._id }).session(session).lean().exec(),
          AuctionLotModel.countDocuments({ seasonRef: season._id, auctionStatus: "pending" }).session(session).exec(),
        ]);
        const blockers = getSeasonCompletionBlockers({ matches, seasonTeams, awards, pendingAuctionLots });
        if (blockers.length) { result = { season: null, blockers }; return; }
        const completed = await SeasonModel.findOneAndUpdate({ _id: season._id, status: "active" }, { $set: { status: "completed" } }, { session, returnDocument: "after" }).lean<SeasonEntity>().exec();
        result = { season: completed, blockers: [] };
      });
      return result;
    } finally { await session.endSession(); }
  }

  async countLots(seasonId: string): Promise<number> {
    return AuctionLotModel.countDocuments({ seasonRef: new Types.ObjectId(seasonId) }).exec();
  }

  async countMatches(seasonId: string): Promise<number> {
    return SeasonMatchModel.countDocuments({ seasonRef: new Types.ObjectId(seasonId) }).exec();
  }

  async countGroups(seasonId: string): Promise<number> {
    return GroupModel.countDocuments({ seasonRef: new Types.ObjectId(seasonId) }).exec();
  }

  async countSeasonTeams(seasonId: string): Promise<number> {
    return SeasonTeamModel.countDocuments({ seasonRef: new Types.ObjectId(seasonId) }).exec();
  }

  async countEligibleSeasonTeams(seasonId: string): Promise<number> {
    return SeasonTeamModel.countDocuments({
      seasonRef: new Types.ObjectId(seasonId),
      status: { $in: ["registered", "active"] },
    }).exec();
  }

  async countPendingLots(seasonId: string): Promise<number> {
    return AuctionLotModel.countDocuments({ seasonRef: new Types.ObjectId(seasonId), auctionStatus: "pending" }).exec();
  }

  async getGroupReadiness(seasonId: string): Promise<SeasonGroupReadiness> {
    const seasonRef = new Types.ObjectId(seasonId);
    const [groups, teams] = await Promise.all([
      GroupModel.find({ seasonRef }).select("_id groupName").lean<Array<{ _id: Types.ObjectId; groupName: string }>>().exec(),
      SeasonTeamModel.find({ seasonRef, status: { $nin: ["withdrawn", "eliminated", "completed"] } }).select("_id groupRef").lean<Array<{ _id: Types.ObjectId; groupRef: Types.ObjectId | null }>>().exec(),
    ]);
    const groupIds = new Set(groups.map((group) => String(group._id)));
    const counts = new Map<string, number>();
    let unassignedTeamCount = 0;
    for (const team of teams) {
      const groupId = team.groupRef ? String(team.groupRef) : "";
      if (!groupId || !groupIds.has(groupId)) {
        unassignedTeamCount += 1;
      } else {
        counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
      }
    }
    const undersizedGroups = groups
      .filter((group) => (counts.get(String(group._id)) ?? 0) < 2)
      .map((group) => group.groupName);
    return { groupCount: groups.length, unassignedTeamCount, undersizedGroups };
  }

  async getMatches(seasonId: string): Promise<SeasonMatchEntity[]> {
    return SeasonMatchModel.find({ seasonRef: new Types.ObjectId(seasonId) }).sort({ matchNumber: 1 }).lean<SeasonMatchEntity[]>().exec();
  }

  async getMaxSoldSquadSize(seasonId: string): Promise<number> {
    const rows = await AuctionLotModel.aggregate<{ count: number }>([
      { $match: { seasonRef: new Types.ObjectId(seasonId), auctionStatus: "sold", seasonTeamRef: { $ne: null } } },
      { $group: { _id: "$seasonTeamRef", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]).exec();
    return rows[0]?.count ?? 0;
  }

  async registerTeamsAtomically(seasonId: string, records: SeasonTeamFields[], limit: number): Promise<SeasonTeamEntity[]> {
    if (!records.length) return [];
    const session = await mongoose.startSession();
    try {
      let created: SeasonTeamEntity[] = [];
      await session.withTransaction(async () => {
        const lock = await SeasonModel.updateOne(
          { _id: new Types.ObjectId(seasonId), status: { $in: ["draft", "upcoming"] } },
          { $inc: { auctionRevision: 1 } },
          { session },
        ).exec();
        if (lock.matchedCount !== 1) throw new Error("SEASON_REGISTRATION_FROZEN");
        const activeCount = await TeamModel.countDocuments({
          _id: { $in: records.map((record) => record.teamRef) },
          status: "active",
        }).session(session).exec();
        if (activeCount !== records.length) throw new Error("SEASON_TEAM_INACTIVE");
        const currentCount = await SeasonTeamModel.countDocuments({ seasonRef: new Types.ObjectId(seasonId) }).session(session).exec();
        if (currentCount + records.length > limit) throw new Error("SEASON_TEAM_LIMIT");
        const docs = await SeasonTeamModel.insertMany(records, { session, ordered: true });
        created = docs.map((doc) => doc.toObject() as unknown as SeasonTeamEntity);
      });
      return created;
    } finally {
      await session.endSession();
    }
  }

  async deleteIfEmptyDraft(seasonId: string): Promise<boolean> {
    const session = await mongoose.startSession();
    try {
      let deleted = false;
      await session.withTransaction(async () => {
        const id = new Types.ObjectId(seasonId);
        const existing = await SeasonModel.findById(id).session(session).select("_id status").lean<{ _id: Types.ObjectId; status: SeasonStatus }>().exec();
        if (!existing) throw new Error("SEASON_NOT_FOUND");
        if (existing.status !== "draft") throw new Error("SEASON_NOT_EMPTY_DRAFT");
        const [teams, groups, lots, matches, awards] = await Promise.all([
          SeasonTeamModel.countDocuments({ seasonRef: id }).session(session).exec(),
          GroupModel.countDocuments({ seasonRef: id }).session(session).exec(),
          AuctionLotModel.countDocuments({ seasonRef: id }).session(session).exec(),
          SeasonMatchModel.countDocuments({ seasonRef: id }).session(session).exec(),
          SeasonAwardModel.countDocuments({ seasonRef: id }).session(session).exec(),
        ]);
        if (teams + groups + lots + matches + awards > 0) throw new Error("SEASON_HAS_DEPENDENCIES");
        const result = await SeasonModel.deleteOne({ _id: id, status: "draft" }).session(session).exec();
        deleted = result.deletedCount === 1;
        if (!deleted) throw new Error("SEASON_DELETE_CONFLICT");
      });
      return deleted;
    } finally {
      await session.endSession();
    }
  }
}
