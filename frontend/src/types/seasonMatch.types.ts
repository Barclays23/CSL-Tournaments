import type { Asset } from "@/types/api.types";
import type { Venue } from "@/types/venue.types";

export type SeasonMatchStage =
  | "group"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

export type MatchPhase=null|"first_half"|"half_time"|"second_half"|"regular_full_time"|"extra_time_first_half"|"extra_time_half_time"|"extra_time_second_half"|"extra_time_completed"|"penalty_shootout"|"penalty_shootout_completed"|"full_time";
export type MatchTimedPeriod="first_half"|"second_half"|"extra_time_first_half"|"extra_time_second_half";
export interface MatchDecidingRules {extraTime:{isAllowed:boolean;durationMinutes:number};penaltyShootout:{isAllowed:boolean};}
export interface MatchClock {isRunning:boolean;clockStartedAt:string|null;periodElapsedSecondsByPeriod:{firstHalf:number;secondHalf:number;extraTimeFirstHalf:number;extraTimeSecondHalf:number};}
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

export type SeasonMatchCardType = "yellow_card" | "red_card" | "second_yellow";

export interface SeasonMatchCard {
  _id: string;
  seasonTeamRef: SeasonMatchTeamRef;
  playerRef: SeasonMatchPlayerRef;
  cardType:SeasonMatchCardType;period?:MatchTimedPeriod|null;minute?:number|null;addedMinutes?:number|null;
  createdAt:string;
}

export interface SeasonMatchGoal {
  _id: string;
  scoringSeasonTeamRef: SeasonMatchTeamRef;
  scorerPlayerRef: SeasonMatchPlayerRef | null;
  playerSeasonTeamRef: SeasonMatchTeamRef | null;
  goalType: "normal" | "own_goal";
  period?:MatchTimedPeriod|null;minute?:number|null;addedMinutes?:number|null;
  createdAt: string;
}

export interface SeasonMatchCorrectionResult {
  homeScore: number;
  awayScore: number;
  goals:Array<{_id:string;scoringSeasonTeamRef:string;scorerPlayerRef:string|null;playerSeasonTeamRef:string|null;goalType:"normal"|"own_goal";period?:MatchTimedPeriod|null;minute?:number|null;addedMinutes?:number|null;createdAt:string}>;
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
  goals:Array<{scoringSeasonTeamRef:string;scorerPlayerRef?:string|null;goalType:"normal"|"own_goal";period?:MatchTimedPeriod|null;minute?:number|null;addedMinutes?:number}>;
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
  matchDurationMinutes:number;decidingRules:MatchDecidingRules;actualStartedAt:string|null;phase:MatchPhase;clock:MatchClock;
  resolutionHistory: Array<{ status: "cancelled" | "abandoned"; reason: string; decidedAt: string }>;
  correctionHistory: SeasonMatchCorrectionHistory[];
  statusHistory: Array<{
    fromStatus: SeasonMatchStatus;
    toStatus: SeasonMatchStatus;
    reason: string | null;
    changedBy: string;
    changedAt: string;
    fromKickoffAt: string | null;
    toKickoffAt: string | null;
  }>;
  goals: SeasonMatchGoal[];
  cards?: SeasonMatchCard[];
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
  groupRef?: string | null;
  status?: SeasonMatchStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  seasonTeamRef?: string;
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
  matchDurationMinutes?:number;
  decidingRules?:MatchDecidingRules;
  penaltyShootout?: SeasonMatch["penaltyShootout"];
}


export type SeasonMatchCreateWrite = Omit<SeasonMatchWrite, "kickoffAt" | "penaltyShootout"> & { kickoffAt: string };
