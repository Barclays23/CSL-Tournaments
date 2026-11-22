import type {Types} from "mongoose";
import type {Asset} from "../../shared/types/common.types.js";
export type SeasonMatchStage="group"|"round_of_16"|"quarter_final"|"semi_final"|"third_place"|"final";
export type SeasonMatchStatus="scheduled"|"live"|"completed"|"postponed"|"cancelled"|"abandoned";
export type SeasonGoalType="normal"|"own_goal";
export type SeasonCardType="yellow_card"|"red_card"|"second_yellow";
export type ShootoutStatus="pending"|"completed";
export type ShootoutKickResult="scored"|"missed"|"saved";
export interface SeasonMatchResolutionEntry{status:"cancelled"|"abandoned";reason:string;decidedAt:Date;}
export interface SeasonMatchCorrectionResult{homeScore:number;awayScore:number;goals:SeasonGoalFields[];penaltyShootout:SeasonPenaltyShootout|null;winnerSeasonTeamRef:Types.ObjectId|null;}
export interface SeasonMatchCorrectionHistoryEntry{reason:string;correctedBy:Types.ObjectId;correctedAt:Date;originalResult:SeasonMatchCorrectionResult;correctedResult:SeasonMatchCorrectionResult;}
export interface SeasonMatchStatusHistoryEntry{fromStatus:SeasonMatchStatus;toStatus:SeasonMatchStatus;reason:string|null;changedBy:Types.ObjectId;changedAt:Date;fromKickoffAt?:Date|null;toKickoffAt?:Date|null;}
export interface SeasonGoalFields{_id?:Types.ObjectId;scoringSeasonTeamRef:Types.ObjectId;scorerPlayerRef:Types.ObjectId|null;playerSeasonTeamRef:Types.ObjectId|null;goalType:SeasonGoalType;createdAt?:Date;}
export interface SeasonShootoutKick{seasonTeamRef:Types.ObjectId;playerRef:Types.ObjectId|null;result:ShootoutKickResult;}
export interface SeasonMatchCardFields{_id?:Types.ObjectId;seasonTeamRef:Types.ObjectId;playerRef:Types.ObjectId;cardType:SeasonCardType;createdAt?:Date;}
export interface SeasonPenaltyShootout{status:ShootoutStatus;homeTeamScore:number;awayTeamScore:number;kicks:SeasonShootoutKick[];}
export interface SeasonMatchFields{seasonRef:Types.ObjectId;matchNumber:number;roundNumber:number;stage:SeasonMatchStage;groupRef:Types.ObjectId|null;kickoffAt:Date;venueRef:Types.ObjectId;homeSeasonTeamRef:Types.ObjectId;awaySeasonTeamRef:Types.ObjectId;status:SeasonMatchStatus;goals:SeasonGoalFields[];cards?:SeasonMatchCardFields[];penaltyShootout:SeasonPenaltyShootout|null;winnerSeasonTeamRef:Types.ObjectId|null;notes:string|null;resolutionHistory:SeasonMatchResolutionEntry[];statusHistory?:SeasonMatchStatusHistoryEntry[];correctionHistory?:SeasonMatchCorrectionHistoryEntry[];}
export interface SeasonMatchEntity extends SeasonMatchFields{_id:Types.ObjectId;createdAt:Date;updatedAt:Date;}
export interface SeasonMatchListFilter{seasonRef:Types.ObjectId;stage?:SeasonMatchStage;groupRef?:Types.ObjectId|null;status?:SeasonMatchStatus;matchNumber?:number;homeSeasonTeamRef?:Types.ObjectId|{$in:Types.ObjectId[]};awaySeasonTeamRef?:Types.ObjectId|{$in:Types.ObjectId[]};kickoffAt?:{$gte?:Date;$lte?:Date};$or?:Array<Partial<SeasonMatchListFilter>>;$and?:Array<{ $or:Array<Partial<SeasonMatchListFilter>> }>; }
export interface MatchTeamSnapshot{_id:Types.ObjectId;displayName:string;logoSnapshot:Asset|null;teamRef:{_id:Types.ObjectId;name:string;shortName:string|null;logo:Asset|null}|Types.ObjectId;}
export interface MatchPlayerSnapshot{_id:Types.ObjectId;name:string;profilePic:Asset|null;}
export interface PopulatedSeasonGoal extends Omit<SeasonGoalFields,"scoringSeasonTeamRef"|"scorerPlayerRef"|"playerSeasonTeamRef">{_id:Types.ObjectId;scoringSeasonTeamRef:Types.ObjectId|MatchTeamSnapshot;scorerPlayerRef:Types.ObjectId|MatchPlayerSnapshot|null;playerSeasonTeamRef:Types.ObjectId|MatchTeamSnapshot|null;createdAt:Date;}
export interface PopulatedSeasonMatchCard extends Omit<SeasonMatchCardFields,"seasonTeamRef"|"playerRef">{_id:Types.ObjectId;seasonTeamRef:Types.ObjectId|MatchTeamSnapshot;playerRef:Types.ObjectId|MatchPlayerSnapshot;createdAt:Date;}
export interface PopulatedSeasonMatch extends Omit<SeasonMatchEntity,"homeSeasonTeamRef"|"awaySeasonTeamRef"|"winnerSeasonTeamRef"|"goals"|"cards"|"venueRef">{venueRef:Types.ObjectId|{_id:Types.ObjectId;name:string;location:string|null}|null;homeSeasonTeamRef:Types.ObjectId|MatchTeamSnapshot;awaySeasonTeamRef:Types.ObjectId|MatchTeamSnapshot;winnerSeasonTeamRef:Types.ObjectId|MatchTeamSnapshot|null;goals:PopulatedSeasonGoal[];cards?:PopulatedSeasonMatchCard[];}
