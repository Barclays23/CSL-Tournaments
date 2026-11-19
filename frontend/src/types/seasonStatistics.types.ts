import type { Asset } from "@/types/api.types";
import type { SeasonBriefDto, SeasonTeamBriefDto, SeasonPlayerPosition, SeasonStatus, AuctionLotStatus } from "@/types/season.types";
import type { SeasonMatchStage, SeasonMatchStatus } from "@/types/seasonMatch.types";

export interface SeasonStandingRow {
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

export interface SeasonGroupStanding {
  groupRef: string | null;
  groupName: string;
  rows: SeasonStandingRow[];
}

export interface SeasonStandings {
  season: SeasonBriefDto;
  groups: SeasonGroupStanding[];
}

export interface SeasonTopScorer {
  rank: number;
  player: { _id: string; name: string; profilePic: Asset | null };
  team: SeasonTeamBriefDto | null;
  position: SeasonPlayerPosition | null;
  jerseyNo: number | null;
  goals: number;
}

export interface SeasonTopScorers {
  season: SeasonBriefDto;
  items: SeasonTopScorer[];
}

export interface SeasonFixture {
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
  penaltyShootout: { homeTeamScore: number; awayTeamScore: number; status: string } | null;
}

export interface SeasonTeamDashboard {
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
    topScorer: { player: { _id: string; name: string; profilePic: unknown }; goals: number } | null;
  };
  recentFixtures: SeasonFixture[];
  upcomingFixtures: SeasonFixture[];
}

export interface PlayerHistory {
  player: {
    _id: string;
    name: string;
    profilePic: unknown;
    status: SeasonStatus;
  };
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
  auctionHistory: Array<{
    season: SeasonBriefDto;
    status: AuctionLotStatus;
    team: SeasonTeamBriefDto | null;
    position: SeasonPlayerPosition;
    jerseyNo: number | null;
    purchasePrice: number | null;
    isIconPlayer: boolean;
    isGoalkeeper: boolean;
    soldAt: string | null;
  }>;
  teamMovementHistory: Array<{
    season: SeasonBriefDto;
    status: string;
    team: SeasonTeamBriefDto | null;
    position: SeasonPlayerPosition;
    jerseyNo: number | null;
    purchasePrice: number | null;
    isIconPlayer: boolean;
    isGoalkeeper: boolean;
    soldAt: string | null;
  }>;
  goalHistory: Array<{ season: SeasonBriefDto; goals: number }>;
  totalNormalGoals: number;
}
