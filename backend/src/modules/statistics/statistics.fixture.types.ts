import type { Types } from "mongoose";
import type { Asset } from "../../shared/types/common.types.js";
import type { SeasonMatchStage, SeasonMatchStatus, SeasonGoalType } from "../matches/seasonMatch.types.js";
export type MatchStage = SeasonMatchStage;
export type MatchStatus = SeasonMatchStatus;
export type GoalType = SeasonGoalType;
export interface GoalFields { _id?: Types.ObjectId; scoringTeamRef: Types.ObjectId; goalType: GoalType; scorerRef: Types.ObjectId | null; ownGoalPlayerRef: Types.ObjectId | null; createdAt?: Date; }
export interface MatchEntity { _id: Types.ObjectId; matchNo: string; stage: MatchStage; groupName: string | null; kickoffAt: Date; venue: string | null; team1Ref: Types.ObjectId; team2Ref: Types.ObjectId; status: MatchStatus; goals: GoalFields[]; penaltyShootout: { team1Score: number; team2Score: number } | null; notes: string | null; createdAt: Date; updatedAt: Date; }
export interface MatchTeamReferenceEntity { _id: Types.ObjectId; name: string; shortName: string | null; logo: Asset | null; groupName: string | null; }
export interface MatchPlayerReferenceEntity { _id: Types.ObjectId; name: string; profilePic: Asset | null; }
export interface MatchPlayerBriefDTO { _id: string; name: string; profilePic: Asset | null; }
export interface PopulatedGoalEntity extends Omit<GoalFields, "_id" | "scoringTeamRef" | "scorerRef" | "ownGoalPlayerRef"> { _id: Types.ObjectId; scoringTeamRef: Types.ObjectId | MatchTeamReferenceEntity; scorerRef: Types.ObjectId | MatchPlayerReferenceEntity | null; ownGoalPlayerRef: Types.ObjectId | MatchPlayerReferenceEntity | null; createdAt: Date; }
export interface PopulatedMatchEntity extends Omit<MatchEntity, "team1Ref" | "team2Ref" | "goals"> { team1Ref: Types.ObjectId | MatchTeamReferenceEntity; team2Ref: Types.ObjectId | MatchTeamReferenceEntity; goals: PopulatedGoalEntity[]; }
