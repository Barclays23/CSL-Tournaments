import type { Asset } from "@/types/api.types";

export type PlayerStatus = "active" | "inactive";
export interface PublicPlayer {
  _id: string;
  name: string;
  profilePic: Asset | null;
  status: PlayerStatus;
}
export interface AdminPlayer extends PublicPlayer {
  mobile: string | null;
  email: string | null;
  dateOfBirth: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface PlayerQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: PlayerStatus | "";
}
export interface PlayerWrite {
  name: string;
  mobile?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  profilePic?: Asset | null;
  status: PlayerStatus;
  notes?: string | null;
}
