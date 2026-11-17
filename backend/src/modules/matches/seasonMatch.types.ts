import type {Types} from "mongoose";
export type SeasonMatchStage="group"|"round_of_16"|"quarter_final"|"semi_final"|"third_place"|"final";
export type SeasonMatchStatus="scheduled"|"live"|"completed"|"postponed"|"cancelled"|"abandoned";
export type SeasonGoalType="normal"|"own_goal";
export type ShootoutStatus="pending"|"completed";
export type ShootoutKickResult="scored"|"missed"|"saved";
export interface SeasonMatchResolutionEntry{status:"cancelled"|"abandoned";reason:string;decidedAt:Date;}
export interface SeasonGoalFields{_id?:Types.ObjectId;scoringSeasonTeamRef:Types.ObjectId;scorerPlayerRef:Types.ObjectId|null;playerSeasonTeamRef:Types.ObjectId|null;goalType:SeasonGoalType;createdAt?:Date;}
export interface SeasonShootoutKick{seasonTeamRef:Types.ObjectId;playerRef:Types.ObjectId|null;result:ShootoutKickResult;}
export interface SeasonPenaltyShootout{status:ShootoutStatus;homeTeamScore:number;awayTeamScore:number;kicks:SeasonShootoutKick[];}
export interface SeasonMatchFields{seasonRef:Types.ObjectId;matchNumber:number;stage:SeasonMatchStage;groupRef:Types.ObjectId|null;kickoffAt:Date;venue:string|null;homeSeasonTeamRef:Types.ObjectId;awaySeasonTeamRef:Types.ObjectId;status:SeasonMatchStatus;goals:SeasonGoalFields[];penaltyShootout:SeasonPenaltyShootout|null;winnerSeasonTeamRef:Types.ObjectId|null;notes:string|null;resolutionHistory:SeasonMatchResolutionEntry[];}
export interface SeasonMatchEntity extends SeasonMatchFields{_id:Types.ObjectId;createdAt:Date;updatedAt:Date;}
export interface SeasonMatchListFilter{seasonRef:Types.ObjectId;stage?:SeasonMatchStage;groupRef?:Types.ObjectId|null;status?:SeasonMatchStatus;matchNumber?:number;homeSeasonTeamRef?:Types.ObjectId|{$in:Types.ObjectId[]};awaySeasonTeamRef?:Types.ObjectId|{$in:Types.ObjectId[]};kickoffAt?:{$gte?:Date;$lte?:Date};$or?:Array<Partial<SeasonMatchListFilter>>;$and?:Array<{ $or:Array<Partial<SeasonMatchListFilter>> }>; }
export interface MatchTeamSnapshot{_id:Types.ObjectId;displayName:string;logoSnapshot:unknown;teamRef:{_id:Types.ObjectId;name:string;shortName:string|null;logo:unknown}|Types.ObjectId;}
export interface MatchPlayerSnapshot{_id:Types.ObjectId;name:string;profilePic:unknown;}
export interface PopulatedSeasonGoal extends Omit<SeasonGoalFields,"scoringSeasonTeamRef"|"scorerPlayerRef"|"playerSeasonTeamRef">{_id:Types.ObjectId;scoringSeasonTeamRef:Types.ObjectId|MatchTeamSnapshot;scorerPlayerRef:Types.ObjectId|MatchPlayerSnapshot|null;playerSeasonTeamRef:Types.ObjectId|MatchTeamSnapshot|null;createdAt:Date;}
export interface PopulatedSeasonMatch extends Omit<SeasonMatchEntity,"homeSeasonTeamRef"|"awaySeasonTeamRef"|"winnerSeasonTeamRef"|"goals">{homeSeasonTeamRef:Types.ObjectId|MatchTeamSnapshot;awaySeasonTeamRef:Types.ObjectId|MatchTeamSnapshot;winnerSeasonTeamRef:Types.ObjectId|MatchTeamSnapshot|null;goals:PopulatedSeasonGoal[];}
