import type { Asset } from "../../shared/types/common.types.js";
import type { SeasonMatchStage, SeasonMatchStatus, SeasonGoalType, SeasonCardType, ShootoutStatus, ShootoutKickResult, MatchPhase, MatchTimedPeriod, MatchDecidingRules, MatchClock, MatchAuditHistoryEntry, MatchEventType, MatchEventOperation } from "./seasonMatch.types.js";

export interface SeasonMatchResolutionDto {
  status: "cancelled" | "abandoned";
  reason: string;
  decidedAt: string;
}
export interface SeasonMatchStatusHistoryDto {
  fromStatus: SeasonMatchStatus;
  toStatus: SeasonMatchStatus;
  reason: string | null;
  changedBy: string;
  changedAt: string;
  fromKickoffAt: string | null;
  toKickoffAt: string | null;
}
export interface RescheduleSeasonMatchDto { kickoffAt: Date; reason?: string; }
export interface SeasonMatchShootoutInput {
  status: ShootoutStatus;
  homeTeamScore: number;
  awayTeamScore: number;
  kicks: Array<{ seasonTeamRef: string; playerRef?: string | null; result: ShootoutKickResult }>;
}
export interface CorrectCompletedMatchDto {
  reason: string;
  goals: SeasonGoalDto[];
  penaltyShootout: SeasonMatchShootoutInput | null;
}
export interface SeasonMatchCorrectionGoalDto {
  _id: string;
  scoringSeasonTeamRef: string;
  scorerPlayerRef: string | null;
  playerSeasonTeamRef: string | null;
  goalType:SeasonGoalType;period?:MatchTimedPeriod|null;minute?:number|null;addedMinutes?:number|null;
  createdAt:string;
}
export interface SeasonMatchCorrectionShootoutDto {
  status: ShootoutStatus;
  homeTeamScore: number;
  awayTeamScore: number;
  kicks: Array<{ seasonTeamRef: string; playerRef: string | null; result: ShootoutKickResult }>;
}
export interface SeasonMatchCorrectionResultDto {
  homeScore: number;
  awayScore: number;
  goals: SeasonMatchCorrectionGoalDto[];
  penaltyShootout: SeasonMatchCorrectionShootoutDto | null;
  winnerSeasonTeamRef: string | null;
}
export interface SeasonMatchCorrectionHistoryDto {
  reason: string;
  correctedBy: string;
  correctedAt: string;
  originalResult: SeasonMatchCorrectionResultDto;
  correctedResult: SeasonMatchCorrectionResultDto;
}
export interface CreateSeasonMatchDto {
  matchNumber: number;
  roundNumber: number;
  stage: SeasonMatchStage;
  groupRef?: string | null;
  kickoffAt: Date;
  venueRef: string;
  homeSeasonTeamRef: string;
  awaySeasonTeamRef: string;
  notes?: string | null;
  matchDurationMinutes?:number;
  decidingRules?:MatchDecidingRules;
}
export type UpdateSeasonMatchDto = Partial<Omit<CreateSeasonMatchDto, "decidingRules">>;
export interface SeasonMatchQueryDto {
  page: number;
  limit: number;
  stage?: SeasonMatchStage;
  groupRef?: string | null;
  status?: SeasonMatchStatus;
  dateFrom?: Date;
  dateTo?: Date;
  seasonTeamRef?: string;
  search?: string;
}
export interface MatchEventTimingDto {period?:MatchTimedPeriod|null;minute?:number|null;addedMinutes?:number;}
export interface UpdateMatchDecidingRulesDto { decidingRules: MatchDecidingRules; reason?: string; }
export type MatchStatusActionDto =
  | { action: "postpone" | "cancel" | "abandon"; reason: string }
  | { action: "resume" };
export interface CorrectActualKickoffDto { actualStartedAt: Date; reason: string; }
export interface CorrectMatchPhaseDto { phase: Exclude<MatchPhase, null | "full_time">; reason: string; }
export interface CorrectMatchClockDto {
  periodElapsedSecondsByPeriod: Partial<MatchClock["periodElapsedSecondsByPeriod"]>;
  reason: string;
}
export interface UpdateMatchShootoutDto {
  homeTeamScore: number;
  awayTeamScore: number;
  kicks: Array<{ seasonTeamRef: string; playerRef?: string | null; result: ShootoutKickResult }>;
}
export interface MatchAuditSnapshotDto {
  status?: SeasonMatchStatus;
  phase?: MatchPhase;
  actualStartedAt?: string | null;
  clock?: Omit<MatchClock, "clockStartedAt"> & { clockStartedAt: string | null };
  decidingRules?: MatchDecidingRules;
  kickoffAt?: string;
  winnerSeasonTeamRef?: string | null;
  penaltyShootout?: SeasonMatchCorrectionShootoutDto | null;
  score?: { homeScore: number; awayScore: number };
}
export interface MatchAuditHistoryDto {
  action: MatchAuditHistoryEntry["action"];
  actor: string;
  timestamp: string;
  previousValue: MatchAuditSnapshotDto;
  newValue: MatchAuditSnapshotDto;
  reason: string | null;
}
export type MatchEventAuditValueDto =
  | { eventType: "goal"; eventId: string; scoringSeasonTeamRef: string; scorerPlayerRef: string | null; playerSeasonTeamRef: string | null; goalType: SeasonGoalType; period: MatchTimedPeriod | null; minute: number | null; addedMinutes: number; createdAt: string | null }
  | { eventType: "card"; eventId: string; seasonTeamRef: string; playerRef: string; cardType: SeasonCardType; period: MatchTimedPeriod | null; minute: number | null; addedMinutes: number; createdAt: string | null };
export interface MatchEventAuditHistoryDto {
  eventId: string;
  eventType: MatchEventType;
  operation: MatchEventOperation;
  actor: string;
  timestamp: string;
  previousValue: MatchEventAuditValueDto | null;
  newValue: MatchEventAuditValueDto | null;
  reason: string | null;
}
export interface SeasonGoalDto extends MatchEventTimingDto {scoringSeasonTeamRef:string;scorerPlayerRef?:string|null;goalType:SeasonGoalType;}
export interface SeasonMatchCardDto extends MatchEventTimingDto {seasonTeamRef:string;playerRef:string;cardType:SeasonCardType;}
export interface SeasonMatchCardResponseDto { _id:string;seasonTeamRef:SeasonMatchTeamDto|string;playerRef:SeasonMatchPlayerDto|string;cardType:SeasonCardType;period?:MatchTimedPeriod|null;minute?:number|null;addedMinutes?:number|null;createdAt:string;}
export interface SeasonMatchTeamDto {
  _id: string;
  displayName: string;
  logoSnapshot: Asset | null;
  team: { _id: string; name: string; shortName: string | null; logo: Asset | null } | null;
}
export interface SeasonMatchPlayerDto { _id: string; name: string; profilePic: Asset | null; }
export interface VenueBriefDto { _id: string; name: string; location: string | null; }
export interface SeasonGoalResponseDto {
  _id: string;
  scoringSeasonTeamRef: SeasonMatchTeamDto | string;
  scorerPlayerRef: SeasonMatchPlayerDto | string | null;
  playerSeasonTeamRef: SeasonMatchTeamDto | string | null;
  goalType: SeasonGoalType;
  period?:MatchTimedPeriod|null;minute?:number|null;addedMinutes?:number|null;
  createdAt: string;
}
export interface SeasonMatchResponseDto {
  _id: string;
  seasonRef: string;
  matchNumber: number;
  roundNumber: number;
  stage: SeasonMatchStage;
  groupRef: string | null;
  kickoffAt: string;
  venueRef: VenueBriefDto | string;
  venue: string | null;
  homeSeasonTeamRef: SeasonMatchTeamDto | string;
  awaySeasonTeamRef: SeasonMatchTeamDto | string;
  status: SeasonMatchStatus;
  matchDurationMinutes:number;decidingRules:MatchDecidingRules;actualStartedAt:string|null;phase:MatchPhase;
  clock:Omit<MatchClock,"clockStartedAt">&{clockStartedAt:string|null};
  goals: SeasonGoalResponseDto[];
  cards: SeasonMatchCardResponseDto[];
  penaltyShootout: {
    status: ShootoutStatus;
    homeTeamScore: number;
    awayTeamScore: number;
    kicks: Array<{ seasonTeamRef: string; playerRef: string | null; result: ShootoutKickResult }>;
  } | null;
  winnerSeasonTeamRef: SeasonMatchTeamDto | string | null;
  notes: string | null;
  resolutionHistory: SeasonMatchResolutionDto[];
  statusHistory: SeasonMatchStatusHistoryDto[];
  correctionHistory: SeasonMatchCorrectionHistoryDto[];
  auditHistory: MatchAuditHistoryDto[];
  eventAuditHistory: MatchEventAuditHistoryDto[];
  createdAt: string;
  updatedAt: string;
}
