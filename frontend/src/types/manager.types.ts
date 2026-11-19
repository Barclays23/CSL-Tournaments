import type { Asset } from "@/types/api.types";

export type PersonStatus = "active" | "inactive";

/** Public manager profile. Seasonal team assignments are returned by SeasonTeam, not Manager. */
export interface PublicManager {
  _id: string;
  name: string;
  role: string | null;
  profilePic: Asset | null;
  status: PersonStatus;
}

export interface AdminManager extends PublicManager {
  mobile: string;
  email: string | null;
  dateOfBirth: string | null;
}

export interface ManagerQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: PersonStatus | "";
}

export interface ManagerWrite {
  name: string;
  mobile: string;
  email?: string | null;
  dateOfBirth?: string | null;
  role?: string | null;
  profilePic?: Asset | null;
  status: PersonStatus;
}

export type ManagerResponse = PublicManager | AdminManager;
