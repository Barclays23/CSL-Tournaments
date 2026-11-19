import type { Asset } from "../../shared/types/common.types.js";
import type { SeasonStatus, SeasonPlayerPosition } from "../seasons/season.types.js";
import type { SeasonMatchStage, SeasonMatchStatus } from "../matches/seasonMatch.types.js";
import type { AuctionLotStatus } from "../auctionLots/auctionLot.types.js";
import type { PlayerStatus } from "../players/player.types.js";

export interface SeasonBriefDto {
  _id: string;
  name: string;
  seasonNumber: number;
  year: number;
  status: SeasonStatus;
}

export interface SeasonTeamBriefDto {
  _id: string;
  teamId: string;
  displayName: string;
  shortName: string | null;
  logo: Asset | null;
  groupRef: string | null;
  groupName: string | null;
}

export interface SeasonStandingRowDto {
  position: number;
  team: SeasonTeamBriefDto;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsScored: number;
  goalsConceded: number;
  goalDifference: number;
  points: number;
  qualified: boolean;
}
export interface SeasonGroupStandingDto {
  groupRef: string | null;
  groupName: string;
  rows: SeasonStandingRowDto[];
}
export interface SeasonStandingsDto {
  season: SeasonBriefDto;
  groups: SeasonGroupStandingDto[];
}

export interface SeasonTopScorerDto {
  rank: number;
  player: { _id: string; name: string; profilePic: Asset | null };
  team: SeasonTeamBriefDto | null;
  position: SeasonPlayerPosition | null;
  jerseyNo: number | null;
  goals: number;
}
export interface SeasonTopScorersDto {
  season: SeasonBriefDto;
  items: SeasonTopScorerDto[];
}

export interface SeasonFixtureDto {
  _id: string;
  matchNumber: number;
  stage: SeasonMatchStage;
  kickoffAt: string;
  status: SeasonMatchStatus;
  home: SeasonTeamBriefDto;
  away: SeasonTeamBriefDto;
  homeScore: number;
  awayScore: number;
  winnerSeasonTeamRef: string | null;
  penaltyShootout: { homeTeamScore: number; awayTeamScore: number; status: "pending" | "completed" } | null;
}

export interface SeasonTeamDashboardDto {
  participates: boolean;
  season: SeasonBriefDto;
  team: { _id: string; name: string; shortName: string | null; logo: Asset | null };
  seasonTeam: SeasonTeamBriefDto | null;
  managers: Array<{ _id: string; name: string; role: string | null; profilePic: Asset | null }>;
  squad: Array<{
    player: { _id: string; name: string; profilePic: Asset | null };
    position: SeasonPlayerPosition;
    jerseyNo: number | null;
    purchasePrice: number | null;
    isIconPlayer: boolean;
    isGoalkeeper: boolean;
  }>;
  stats: {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsScored: number;
    goalsConceded: number;
    goalDifference: number;
    cleanSheets: number;
    topScorer: { player: { _id: string; name: string; profilePic: Asset | null }; goals: number } | null;
  };
  recentFixtures: SeasonFixtureDto[];
  upcomingFixtures: SeasonFixtureDto[];
}

export interface PlayerAuctionHistoryDto {
  season: SeasonBriefDto;
  status: AuctionLotStatus;
  team: SeasonTeamBriefDto | null;
  position: SeasonPlayerPosition;
  jerseyNo: number | null;
  purchasePrice: number | null;
  isIconPlayer: boolean;
  isGoalkeeper: boolean;
  soldAt: string | null;
}

export interface PlayerHistoryDto {
  player: { _id: string; name: string; profilePic: Asset | null; status: PlayerStatus };
  currentSeason: SeasonBriefDto | null;
  currentSeasonTeam: {
    seasonTeamId: string;
    team: SeasonTeamBriefDto;
    position: SeasonPlayerPosition;
    jerseyNo: number | null;
    purchasePrice: number | null;
    isIconPlayer: boolean;
    isGoalkeeper: boolean;
  } | null;
  auctionHistory: PlayerAuctionHistoryDto[];
  teamMovementHistory: PlayerAuctionHistoryDto[];
  goalHistory: Array<{ season: SeasonBriefDto; goals: number }>;
  totalNormalGoals: number;
}
