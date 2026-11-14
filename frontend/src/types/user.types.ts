import type { Asset } from "@/types/api.types";

export type UserRole = "user" | "admin";
export type UserStatus = "active" | "blocked";

export interface User {
  _id: string;
  name: string;
  email: string;
  mobile: string | null;
  username: string | null;
  role: UserRole;
  profilePic: Asset | null;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface UserQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole | "";
  status?: UserStatus | "";
}
export interface UserWrite {
  name: string;
  email: string;
  mobile?: string | null;
  username?: string | null;
  password?: string;
  role: UserRole;
  status: UserStatus;
  profilePic?: Asset | null;
}
