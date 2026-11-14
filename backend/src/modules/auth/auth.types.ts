import type { AdminUserDTO } from "../users/user.types.js";
import type { AuthSessionDTO } from "./auth.dto.js";
import type { LoginInput } from "./auth.dto.js";

export interface JwtAdminPayload {
  sub: string;
  email: string;
  role: "user" | "admin";
  iat?: number;
  exp?: number;
}
export type JwtAuthPayload = JwtAdminPayload;

export type { IAuthService, IAuthController } from "./auth.interfaces.js";
export type { AuthSessionDTO } from "./auth.dto.js";
export type { LoginCredentials } from "./auth.dto.js";
