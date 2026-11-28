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

export type MatchAuditAction =
  | "start_match" | "pause_clock" | "resume_clock" | "phase_transition" | "phase_correction"
  | "status_change" | "deciding_rules_change" | "actual_kickoff_correction" | "clock_correction"
  | "shootout_update" | "completed_match_correction";

export interface MatchAuditSnapshot {
  status?: SeasonMatchStatus;
  phase?: MatchPhase;
  actualStartedAt?: string | null;
  clock?: MatchClock;
  decidingRules?: MatchDecidingRules;
  kickoffAt?: string;
  winnerSeasonTeamRef?: string | null;
  penaltyShootout?: SeasonMatch["penaltyShootout"] | null;
  score?: { homeScore: number; awayScore: number };
}

export interface MatchAuditHistoryEntry {
  action: MatchAuditAction;
  actor: string;
  timestamp: string;
  previousValue: MatchAuditSnapshot;
  newValue: MatchAuditSnapshot;
  reason: string | null;
}

export interface GoalEventAuditValue {
  eventId: string;
  scoringSeasonTeamRef: string;
  scorerPlayerRef: string | null;
  playerSeasonTeamRef: string | null;
  goalType: "normal" | "own_goal";
  period: MatchTimedPeriod | null;
  minute: number | null;
  addedMinutes: number;
  createdAt: string | null;
}
export interface CardEventAuditValue {
  eventId: string;
  seasonTeamRef: string;
  playerRef: string;
  cardType: SeasonMatchCardType;
  period: MatchTimedPeriod | null;
  minute: number | null;
  addedMinutes: number;
  createdAt: string | null;
}
export type MatchEventAuditValue =
  | ({ eventType: "goal" } & GoalEventAuditValue)
  | ({ eventType: "card" } & CardEventAuditValue);
export interface MatchEventAuditHistoryEntry {
  eventId: string;
  eventType: "goal" | "card";
  operation: "created" | "updated" | "deleted";
  actor: string;
  timestamp: string;
  previousValue: MatchEventAuditValue | null;
  newValue: MatchEventAuditValue | null;
  reason: string | null;
}

export interface ActualKickoffCorrectionWrite {
  actualStartedAt: string;
  reason: string;
}
export interface MatchClockCorrectionWrite {
  periodElapsedSecondsByPeriod: Partial<MatchClock["periodElapsedSecondsByPeriod"]>;
  reason: string;
}
export interface MatchPhaseCorrectionWrite {
  phase: Exclude<MatchPhase, null | "full_time">;
  reason: string;
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
  auditHistory?: MatchAuditHistoryEntry[];
  eventAuditHistory?: MatchEventAuditHistoryEntry[];
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
  notes?: string | null;
  matchDurationMinutes?: number;
  /** Initial values copied from Season defaults and reviewed only during fixture creation. */
  decidingRules?: MatchDecidingRules;
}

export type SeasonMatchCreateWrite = Omit<SeasonMatchWrite, "kickoffAt"> & { kickoffAt: string };
export type SeasonMatchFixtureUpdate = Partial<Omit<SeasonMatchWrite, "decidingRules">>;
export type MatchPhaseAction =
  | "half_time"
  | "start_second_half"
  | "regular_full_time"
  | "start_extra_time"
  | "extra_time_half_time"
  | "start_extra_time_second_half"
  | "end_extra_time"
  | "start_penalty_shootout"
  | "complete_penalty_shootout";
export type MatchStatusAction =
  | { action: "postpone"; reason: string }
  | { action: "cancel"; reason: string }
  | { action: "abandon"; reason: string }
  | { action: "resume" };
export interface MatchEventTimingWrite {
  period?: MatchTimedPeriod | null;
  minute?: number | null;
  addedMinutes?: number | null;
}
export interface MatchShootoutWrite {
  homeTeamScore: number;
  awayTeamScore: number;
  kicks: NonNullable<SeasonMatch["penaltyShootout"]>["kicks"];
}
