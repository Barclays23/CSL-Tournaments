import { MatchModel } from "../matches/match.model.js";
import { AuctionLotModel } from "../auctionLots/auctionLot.model.js";
import { SeasonModel } from "../seasons/season.model.js";
import type { MatchEntity, PopulatedMatchEntity } from "../matches/match.types.js";
import { PlayerModel } from "../players/player.model.js";
import type { PlayerStatisticsEntity } from "../players/player.types.js";
import { TeamModel } from "../teams/team.model.js";
import type { TeamEntity } from "../teams/team.types.js";
import { IStatisticsRepository } from "./statistics.types.js";
import type { DashboardAuctionTotalsDTO } from "./statistics.dto.js";

const populatedFixturePaths = [
  { path: "team1Ref", select: "name shortName logo groupName" },
  { path: "team2Ref", select: "name shortName logo groupName" },
  { path: "goals.scoringTeamRef", select: "name shortName logo groupName" },
  { path: "goals.scorerRef", select: "name profilePic" },
  { path: "goals.ownGoalPlayerRef", select: "name profilePic" },
];


export class StatisticsRepository implements IStatisticsRepository {
  async findCompletedMatches(): Promise<MatchEntity[]> {
    return MatchModel.find({ status: "completed" })
      .sort({ kickoffAt: 1 })
      .lean<MatchEntity[]>()
      .exec();
  }

  async findCompletedGroupStageMatches(): Promise<MatchEntity[]> {
    return MatchModel.find({ status: "completed", stage: "group" })
      .sort({ kickoffAt: 1 })
      .lean<MatchEntity[]>()
      .exec();
  }

  async findAllTeams(): Promise<TeamEntity[]> {
    return TeamModel.find().sort({ name: 1 }).lean<TeamEntity[]>().exec();
  }

  async findActiveTeams(): Promise<TeamEntity[]> {
    return TeamModel.find({ status: "active" }).sort({ name: 1 }).lean<TeamEntity[]>().exec();
  }

  async findPlayersForTournamentStatistics(): Promise<PlayerStatisticsEntity[]> {
    return PlayerModel.find()
      .select("name status profilePic")
      .sort({ name: 1 })
      .lean<PlayerStatisticsEntity[]>()
      .exec();
  }

  async findUpcomingFixtureCards(limit: number): Promise<PopulatedMatchEntity[]> {
    return MatchModel.find({ status: "scheduled" })
      .sort({ kickoffAt: 1 })
      .limit(limit)
      .populate(populatedFixturePaths)
      .lean<PopulatedMatchEntity[]>()
      .exec();
  }

  async findRecentResultCards(limit: number): Promise<PopulatedMatchEntity[]> {
    return MatchModel.find({ status: "completed" })
      .sort({ kickoffAt: -1 })
      .limit(limit)
      .populate(populatedFixturePaths)
      .lean<PopulatedMatchEntity[]>()
      .exec();
  }

  async getActiveSeasonAuctionTotals(): Promise<DashboardAuctionTotalsDTO> {
    const season = await SeasonModel.findOne({ status: "active" }).select("_id").lean<{ _id: import("mongoose").Types.ObjectId } | null>().exec();
    const activeAuctionPlayers = await PlayerModel.countDocuments({ status: "active" }).exec();
    if (!season) return { activeAuctionPlayers, pendingPlayers: 0, soldPlayers: 0, unsoldPlayers: 0, totalAuctionSpend: 0 };
    const rows = await AuctionLotModel.aggregate<{
      _id: "pending" | "sold" | "unsold" | "withdrawn";
      count: number;
      spend: number;
    }>([
      { $match: { seasonRef: season._id } },
      { $lookup: { from: PlayerModel.collection.name, localField: "playerRef", foreignField: "_id", as: "player" } },
      { $unwind: "$player" },
      { $match: { "player.status": "active" } },
      { $group: {
        _id: "$auctionStatus",
        count: { $sum: 1 },
        spend: { $sum: { $cond: [{ $eq: ["$auctionStatus", "sold"] }, { $ifNull: ["$purchasePrice", 0] }, 0] } },
      } },
    ]).exec();
    const countFor = (status: "pending" | "sold" | "unsold") => rows.find((row) => row._id === status)?.count ?? 0;
    return {
      activeAuctionPlayers,
      pendingPlayers: countFor("pending"),
      soldPlayers: countFor("sold"),
      unsoldPlayers: countFor("unsold"),
      totalAuctionSpend: rows.find((row) => row._id === "sold")?.spend ?? 0,
    };
  }

  async countScheduledFixtures(): Promise<number> {
    return MatchModel.countDocuments({ status: "scheduled" }).exec();
  }
}
