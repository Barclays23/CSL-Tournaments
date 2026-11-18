import { Types } from "mongoose";
import { AuctionLotModel } from "../auctionLots/auctionLot.model.js";
import { SeasonModel } from "../seasons/season.model.js";
import { SeasonTeamModel } from "../seasonTeams/seasonTeam.model.js";
import { SeasonMatchModel } from "../matches/seasonMatch.model.js";
import { PlayerModel } from "../players/player.model.js";
import type { PlayerStatisticsEntity } from "../players/player.types.js";
import { TeamModel } from "../teams/team.model.js";
import type { TeamEntity } from "../teams/team.types.js";
import type { IStatisticsRepository } from "./statistics.interfaces.js";
import type { DashboardAuctionTotalsDTO } from "./statistics.dto.js";
import type { MatchEntity, MatchPlayerReferenceEntity, MatchTeamReferenceEntity, PopulatedMatchEntity } from "./statistics.fixture.types.js";

const matchPopulation = [
  { path: "groupRef", select: "groupName" },
  { path: "homeSeasonTeamRef", select: "displayName teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "awaySeasonTeamRef", select: "displayName teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "goals.scoringSeasonTeamRef", select: "displayName teamRef", populate: { path: "teamRef", select: "name shortName logo" } },
  { path: "goals.scorerPlayerRef", select: "name profilePic" },
];
type RawSeasonTeam = { _id: Types.ObjectId; teamRef: Types.ObjectId | { _id: Types.ObjectId; name: string; shortName: string | null; logo: any }; displayName?: string };
type RawGoal = { _id: Types.ObjectId; scoringSeasonTeamRef: RawSeasonTeam | Types.ObjectId; scorerPlayerRef: (MatchPlayerReferenceEntity & { _id: Types.ObjectId }) | Types.ObjectId | null; goalType: "normal" | "own_goal"; createdAt?: Date };
type RawSeasonMatch = { _id: Types.ObjectId; matchNumber: number; stage: MatchEntity["stage"]; groupRef?: { groupName?: string } | Types.ObjectId | null; kickoffAt: Date; venue: string | null; homeSeasonTeamRef: RawSeasonTeam | Types.ObjectId; awaySeasonTeamRef: RawSeasonTeam | Types.ObjectId; status: MatchEntity["status"]; goals: RawGoal[]; penaltyShootout: { homeTeamScore: number; awayTeamScore: number } | null; notes: string | null; createdAt: Date; updatedAt: Date };

export class StatisticsRepository implements IStatisticsRepository {
  private async currentSeasonId(): Promise<Types.ObjectId | null> {
    const season = await SeasonModel.findOne({ status: "active" }).select("_id").lean<{ _id: Types.ObjectId } | null>().exec()
      ?? await SeasonModel.findOne().sort({ seasonNumber: -1 }).select("_id").lean<{ _id: Types.ObjectId } | null>().exec();
    return season?._id ?? null;
  }
  private teamId(ref: RawSeasonTeam | Types.ObjectId): Types.ObjectId {
    if (ref instanceof Types.ObjectId) return ref;
    return ref.teamRef instanceof Types.ObjectId ? ref.teamRef : ref.teamRef._id;
  }
  private teamReference(ref: RawSeasonTeam | Types.ObjectId, groupName: string | null = null): Types.ObjectId | MatchTeamReferenceEntity {
    if (ref instanceof Types.ObjectId) return ref;
    if (ref.teamRef instanceof Types.ObjectId) return ref.teamRef;
    return { _id: ref.teamRef._id, name: ref.teamRef.name, shortName: ref.teamRef.shortName, logo: ref.teamRef.logo, groupName };
  }
  private toEntity(match: RawSeasonMatch): MatchEntity {
    const groupName = match.groupRef && !(match.groupRef instanceof Types.ObjectId) ? match.groupRef.groupName ?? null : null;
    return {
      _id: match._id, matchNo: String(match.matchNumber), stage: match.stage, groupName, kickoffAt: match.kickoffAt,
      venue: match.venue, team1Ref: this.teamId(match.homeSeasonTeamRef), team2Ref: this.teamId(match.awaySeasonTeamRef),
      status: match.status,
      goals: match.goals.map((goal) => ({
        _id: goal._id, scoringTeamRef: this.teamId(goal.scoringSeasonTeamRef), goalType: goal.goalType,
        scorerRef: goal.scorerPlayerRef ? (goal.scorerPlayerRef instanceof Types.ObjectId ? goal.scorerPlayerRef : goal.scorerPlayerRef._id) : null,
        ownGoalPlayerRef: goal.goalType === "own_goal" && goal.scorerPlayerRef
          ? (goal.scorerPlayerRef instanceof Types.ObjectId ? goal.scorerPlayerRef : goal.scorerPlayerRef._id) : null,
        createdAt: goal.createdAt ?? match.kickoffAt,
      })),
      penaltyShootout: match.penaltyShootout ? { team1Score: match.penaltyShootout.homeTeamScore, team2Score: match.penaltyShootout.awayTeamScore } : null,
      notes: match.notes, createdAt: match.createdAt, updatedAt: match.updatedAt,
    };
  }
  private toPopulated(match: RawSeasonMatch): PopulatedMatchEntity {
    const groupName = match.groupRef && !(match.groupRef instanceof Types.ObjectId) ? match.groupRef.groupName ?? null : null;
    return {
      ...this.toEntity(match),
      team1Ref: this.teamReference(match.homeSeasonTeamRef, groupName),
      team2Ref: this.teamReference(match.awaySeasonTeamRef, groupName),
      goals: match.goals.map((goal) => {
        const scorer = goal.scorerPlayerRef;
        return { _id: goal._id, scoringTeamRef: this.teamReference(goal.scoringSeasonTeamRef, groupName), goalType: goal.goalType,
          scorerRef: scorer, ownGoalPlayerRef: goal.goalType === "own_goal" ? scorer : null, createdAt: goal.createdAt ?? match.kickoffAt };
      }),
    };
  }
  async findCompletedMatches(): Promise<MatchEntity[]> {
    const id = await this.currentSeasonId(); if (!id) return [];
    const rows = await SeasonMatchModel.find({ seasonRef: id, status: "completed" }).sort({ kickoffAt: 1 }).populate(matchPopulation).lean<RawSeasonMatch[]>().exec();
    return rows.map((row) => this.toEntity(row));
  }
  async findCompletedGroupStageMatches(): Promise<MatchEntity[]> {
    const id = await this.currentSeasonId(); if (!id) return [];
    const rows = await SeasonMatchModel.find({ seasonRef: id, status: "completed", stage: "group" }).sort({ kickoffAt: 1 }).populate(matchPopulation).lean<RawSeasonMatch[]>().exec();
    return rows.map((row) => this.toEntity(row));
  }
  async findAllTeams(): Promise<TeamEntity[]> { return TeamModel.find().sort({ name: 1 }).lean<TeamEntity[]>().exec(); }
  async findActiveTeams(): Promise<TeamEntity[]> {
    const id = await this.currentSeasonId(); if (!id) return [];
    const ids = await SeasonTeamModel.distinct("teamRef", { seasonRef: id, status: "active" }).exec();
    return ids.length ? TeamModel.find({ _id: { $in: ids }, status: "active" }).sort({ name: 1 }).lean<TeamEntity[]>().exec() : [];
  }
  async findPlayersForTournamentStatistics(): Promise<PlayerStatisticsEntity[]> {
    return PlayerModel.find().select("name status profilePic").sort({ name: 1 }).lean<PlayerStatisticsEntity[]>().exec();
  }
  async findUpcomingFixtureCards(limit: number): Promise<PopulatedMatchEntity[]> {
    const id = await this.currentSeasonId(); if (!id) return [];
    const rows = await SeasonMatchModel.find({ seasonRef: id, status: "scheduled" }).sort({ kickoffAt: 1 }).limit(limit).populate(matchPopulation).lean<RawSeasonMatch[]>().exec();
    return rows.map((row) => this.toPopulated(row));
  }
  async findRecentResultCards(limit: number): Promise<PopulatedMatchEntity[]> {
    const id = await this.currentSeasonId(); if (!id) return [];
    const rows = await SeasonMatchModel.find({ seasonRef: id, status: "completed" }).sort({ kickoffAt: -1 }).limit(limit).populate(matchPopulation).lean<RawSeasonMatch[]>().exec();
    return rows.map((row) => this.toPopulated(row));
  }
  async getActiveSeasonAuctionTotals(): Promise<DashboardAuctionTotalsDTO> {
    const id = await this.currentSeasonId(); const activeAuctionPlayers = await PlayerModel.countDocuments({ status: "active" }).exec();
    if (!id) return { activeAuctionPlayers, pendingPlayers: 0, soldPlayers: 0, unsoldPlayers: 0, totalAuctionSpend: 0 };
    const rows = await AuctionLotModel.aggregate<{ _id: "pending" | "sold" | "unsold" | "withdrawn"; count: number; spend: number }>([
      { $match: { seasonRef: id } }, { $lookup: { from: PlayerModel.collection.name, localField: "playerRef", foreignField: "_id", as: "player" } },
      { $unwind: "$player" }, { $match: { "player.status": "active" } },
      { $group: { _id: "$auctionStatus", count: { $sum: 1 }, spend: { $sum: { $cond: [{ $eq: ["$auctionStatus", "sold"] }, { $ifNull: ["$purchasePrice", 0] }, 0] } } } },
    ]).exec();
    const count = (status: "pending" | "sold" | "unsold") => rows.find((row) => row._id === status)?.count ?? 0;
    return { activeAuctionPlayers, pendingPlayers: count("pending"), soldPlayers: count("sold"), unsoldPlayers: count("unsold"), totalAuctionSpend: rows.find((row) => row._id === "sold")?.spend ?? 0 };
  }
  async countScheduledFixtures(): Promise<number> {
    const id = await this.currentSeasonId(); return id ? SeasonMatchModel.countDocuments({ seasonRef: id, status: "scheduled" }).exec() : 0;
  }
}
