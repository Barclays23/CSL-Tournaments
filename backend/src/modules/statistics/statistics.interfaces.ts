import type { GroupStandingDTO, TopScorerDTO, DashboardSummaryDTO, OverallTeamStatisticsDTO, TeamStatisticsDTO, DashboardAuctionTotalsDTO } from "./statistics.dto.js";
import type { MatchEntity, PopulatedMatchEntity } from "./statistics.fixture.types.js";
import type { PlayerStatisticsEntity } from "../players/player.types.js";
import type { TeamEntity } from "../teams/team.types.js";
import type { ControllerMethod } from "../../shared/types/common.types.js";
export interface IStatisticsRepository {
  findCompletedMatches(): Promise<MatchEntity[]>;
  findCompletedGroupStageMatches(): Promise<MatchEntity[]>;
  findAllTeams(): Promise<TeamEntity[]>;
  findActiveTeams(): Promise<TeamEntity[]>;
  findPlayersForTournamentStatistics(): Promise<PlayerStatisticsEntity[]>;
  findUpcomingFixtureCards(limit: number): Promise<PopulatedMatchEntity[]>;
  findRecentResultCards(limit: number): Promise<PopulatedMatchEntity[]>;
  countScheduledFixtures(): Promise<number>;
  getActiveSeasonAuctionTotals(): Promise<DashboardAuctionTotalsDTO>;
}
export interface IStatisticsService {
  getDashboardStatistics(): Promise<DashboardSummaryDTO>;
  getGroupStandings(): Promise<GroupStandingDTO[]>;
  getTopScorers(): Promise<TopScorerDTO[]>;
  getOverallTeamStatistics(): Promise<OverallTeamStatisticsDTO[]>;
  getTeamStatistics(teamId: string): Promise<TeamStatisticsDTO>;
}
export interface IStatisticsController {
  getDashboardStatistics: ControllerMethod;
  getGroupStandings: ControllerMethod;
  getTopScorers: ControllerMethod;
}
