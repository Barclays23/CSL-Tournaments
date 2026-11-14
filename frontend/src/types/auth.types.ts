import type { Asset } from "@/types/api.types";

export type AuthRole = "user" | "admin";

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  mobile?: string | null;
  username?: string | null;
  role: AuthRole;
  status: "active" | "blocked";
  profilePic?: Asset | null;
}
