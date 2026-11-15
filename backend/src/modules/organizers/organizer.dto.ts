import type { Asset } from "../../shared/types/common.types.js";
import type { OrganizerStatus } from "./organizer.types.js";

export interface CreateOrganizerDto {
  name: string;
  title: string;
  mobile?: string | null;
  email?: string | null;
  profilePic?: Asset | null;
  displayOrder?: number;
  status?: OrganizerStatus;
  notes?: string | null;
}
export type UpdateOrganizerDto = Partial<CreateOrganizerDto>;
export interface OrganizerQueryDto {
  page: number;
  limit: number;
  search?: string;
  title?: string;
  status?: OrganizerStatus;
}
export interface OrganizerListFilter {
  status?: OrganizerStatus;
  title?: { $regex: string; $options: "i" };
  $or?: Array<Record<string, unknown>>;
}
export interface PublicOrganizerDTO {
  _id: string;
  name: string;
  title: string;
  profilePic: Asset | null;
  displayOrder: number;
}
export interface AdminOrganizerDTO extends PublicOrganizerDTO {
  mobile: string | null;
  email: string | null;
  status: OrganizerStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
export type OrganizerResponseDTO = PublicOrganizerDTO | AdminOrganizerDTO;
