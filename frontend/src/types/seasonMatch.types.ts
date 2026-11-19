import type { Asset } from "@/types/api.types";
import type { Venue } from "@/types/venue.types";

export type SeasonMatchStage =
  | "group"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

export type SeasonMatchStatus =
  | "scheduled"
  | "live"
  | "completed"
  | "postponed"
  | "cancelled"
  | "abandoned";

export interface SeasonGroup {
  _id: string;
  seasonRef: string;
  groupName: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SeasonMatchTeam {
  _id: string;
  displayName: string;
  logoSnapshot: Asset | null;
  team: {
    _id: string;
    name: string;
    shortName: string | null;
    logo: Asset | null;
  } | null;
}

export interface SeasonMatchPlayer {
  _id: string;
  name: string;
  profilePic: Asset | null;
}

export type SeasonMatchTeamRef = string | SeasonMatchTeam;
export type SeasonMatchPlayerRef = string | SeasonMatchPlayer;

export interface SeasonMatchGoal {
  _id: string;
  scoringSeasonTeamRef: SeasonMatchTeamRef;
  scorerPlayerRef: SeasonMatchPlayerRef | null;
  playerSeasonTeamRef: SeasonMatchTeamRef | null;
  goalType: "normal" | "own_goal";
  createdAt: string;
}

export interface SeasonMatchCorrectionResult {
  homeScore: number;
  awayScore: number;
  goals: Array<{ _id: string; scoringSeasonTeamRef: string; scorerPlayerRef: string | null; playerSeasonTeamRef: string | null; goalType: "normal" | "own_goal"; createdAt: string }>;
  penaltyShootout: SeasonMatch["penaltyShootout"] | null;
  winnerSeasonTeamRef: string | null;
}
export interface SeasonMatchCorrectionHistory {
  reason: string;
  correctedBy: string;
  correctedAt: string;
  originalResult: SeasonMatchCorrectionResult;
  correctedResult: SeasonMatchCorrectionResult;
}
export interface SeasonMatchCorrectionWrite {
  reason: string;
  goals: Array<{ scoringSeasonTeamRef: string; scorerPlayerRef?: string | null; goalType: "normal" | "own_goal" }>;
  penaltyShootout: SeasonMatch["penaltyShootout"];
}

export interface SeasonMatch {
  _id: string;
  seasonRef: string;
  matchNumber: number;
  roundNumber: number;
  stage: SeasonMatchStage;
  groupRef: string | null;
  kickoffAt: string;
  venueRef: string | Pick<Venue, "_id" | "name" | "location">;
  venue: string | null;
  homeSeasonTeamRef: SeasonMatchTeamRef;
  awaySeasonTeamRef: SeasonMatchTeamRef;
  status: SeasonMatchStatus;
  resolutionHistory?: Array<{ status: "cancelled" | "abandoned"; reason: string; decidedAt: string }>;
  correctionHistory?: SeasonMatchCorrectionHistory[];
  statusHistory?: Array<{
    fromStatus: SeasonMatchStatus;
    toStatus: SeasonMatchStatus;
    reason: string | null;
    changedBy: string;
    changedAt: string;
    fromKickoffAt?: string | null;
    toKickoffAt?: string | null;
  }>;
  goals: SeasonMatchGoal[];
  penaltyShootout: {
    status: "pending" | "completed";
    homeTeamScore: number;
    awayTeamScore: number;
    kicks: Array<{
      seasonTeamRef: string;
      playerRef: string | null;
      result: "scored" | "missed" | "saved";
    }>;
  } | null;
  winnerSeasonTeamRef: SeasonMatchTeamRef | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeasonMatchQuery {
  page?: number;
  limit?: number;
  stage?: SeasonMatchStage;
  groupRef?: string;
  status?: SeasonMatchStatus;
  search?: string;
}

export interface SeasonMatchWrite {
  matchNumber: number;
  roundNumber: number;
  stage: SeasonMatchStage;
  groupRef?: string | null;
  kickoffAt?: string;
  venueRef: string;
  homeSeasonTeamRef: string;
  awaySeasonTeamRef: string;
  status?: SeasonMatchStatus;
  notes?: string | null;
}

