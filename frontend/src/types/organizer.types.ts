import type { Asset } from "@/types/api.types";

export type OrganizerStatus = "active" | "inactive";
export interface PublicOrganizer {
  _id: string;
  name: string;
  title: string;
  profilePic: Asset | null;
  displayOrder: number;
}
export interface AdminOrganizer extends PublicOrganizer {
  mobile: string | null;
  email: string | null;
  status: OrganizerStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
export type Organizer = PublicOrganizer | AdminOrganizer;
export interface OrganizerQuery {
  page?: number;
  limit?: number;
  search?: string;
  title?: string;
  status?: OrganizerStatus | "";
}
export interface OrganizerWrite {
  name: string;
  title: string;
  mobile?: string | null;
  email?: string | null;
  displayOrder?: number;
  status: OrganizerStatus;
  notes?: string | null;
  profilePic?: Asset | null;
}
