import type { Types } from "mongoose";
import type { Asset } from "../../shared/types/common.types.js";

export type SeasonTeamStatus = "registered" | "active" | "withdrawn" | "eliminated" | "completed";
export interface SeasonTeamFields {
  seasonRef: Types.ObjectId;
  teamRef: Types.ObjectId;
  displayName: string;
  logoSnapshot: Asset | null;
  groupRef: Types.ObjectId | null;
  managerRefs: Types.ObjectId[];
  status: SeasonTeamStatus;
  participationHistory?: Array<{ fromStatus: SeasonTeamStatus; toStatus: SeasonTeamStatus; reason: string; changedAt: Date }>;
}
export interface SeasonTeamEntity extends SeasonTeamFields {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export interface SeasonTeamListFilter { seasonRef: Types.ObjectId; status?: SeasonTeamStatus; }
