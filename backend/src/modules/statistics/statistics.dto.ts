import type { MatchStage, MatchStatus, MatchPlayerBriefDTO } from "./statistics.fixture.types.js";
import type { PlayerPublicDTO } from "../players/player.dto.js";
import type { TeamBriefDTO } from "../teams/team.dto.js";

export interface MatchResponseDTO {
  _id: string; matchNo: string; stage: MatchStage; groupName: string | null; kickoffAt: string; venue: string | null;
  team1Ref: string | TeamBriefDTO; team2Ref: string | TeamBriefDTO; status: MatchStatus;
  goals: Array<{ _id: string; scoringTeamRef: string | TeamBriefDTO; goalType: "normal" | "own_goal"; scorerRef: string | MatchPlayerBriefDTO | null; ownGoalPlayerRef: string | MatchPlayerBriefDTO | null; createdAt: string }>;
  penaltyShootout: { team1Score: number; team2Score: number } | null; notes: string | null; createdAt: string; updatedAt: string;
}
export interface StandingRowDTO {
  position: number;
  team: TeamBriefDTO;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  qualified: boolean;
}
export interface GroupStandingDTO { groupName: string; rows: StandingRowDTO[]; }
export interface TopScorerDTO { rank: number; player: PlayerPublicDTO; team: TeamBriefDTO | null; goals: number; }
export interface NamedTeamCountDTO { team: TeamBriefDTO; goals?: number; cleanSheets?: number; }
export interface DashboardSummaryDTO {
  tournamentName: string; startDate: string; endDate: string;
  totalMatchesPlayed: number; totalGoals: number; activeTeams: number; activePlayers: number;
  pendingPlayers: number; soldPlayers: number; unsoldPlayers: number; totalAuctionSpend: number;
  upcomingMatchCount: number; topScorer: TopScorerDTO | null;
  mostScoringTeam: { team: TeamBriefDTO; goals: number } | null;
  mostConcedingTeam: { team: TeamBriefDTO; goals: number } | null;
  mostCleanSheets: { team: TeamBriefDTO; cleanSheets: number }[];
  upcomingFixtures: MatchResponseDTO[]; recentResults: MatchResponseDTO[]; alerts: string[];
}
export interface OverallTeamStatisticsDTO { team: TeamBriefDTO; played: number; goalsFor: number; goalsAgainst: number; cleanSheets: number; }
export interface TeamStatisticsDTO {
  team: TeamBriefDTO;
  group: { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number; };
  overall: { played: number; goalsFor: number; goalsAgainst: number; cleanSheets: number; };
}

export interface DashboardAuctionTotalsDTO {
  activeAuctionPlayers: number;
  pendingPlayers: number;
  soldPlayers: number;
  unsoldPlayers: number;
  totalAuctionSpend: number;
}
