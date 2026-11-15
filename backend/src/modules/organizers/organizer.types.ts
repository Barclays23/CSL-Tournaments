import type { Types } from "mongoose";
import type { Asset } from "../../shared/types/common.types.js";
import type { OrganizerListFilter } from "./organizer.dto.js";

export type OrganizerStatus = "active" | "inactive";
export interface OrganizerFields {
  name: string;
  title: string;
  mobile: string | null;
  email: string | null;
  profilePic: Asset | null;
  displayOrder: number;
  status: OrganizerStatus;
  notes: string | null;
}
export interface OrganizerEntity extends OrganizerFields {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export type { OrganizerListFilter };
