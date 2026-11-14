import type { LoginCredentials, AuthSessionDTO } from "./auth.types.js";
import type { AdminUserDTO } from "../users/user.types.js";
import type { ControllerMethod } from "../../shared/types/common.types.js";

export interface IAuthService {
  login(credentials: LoginCredentials): Promise<AuthSessionDTO>;
  getCurrentUser(userId: string): Promise<AdminUserDTO>;
}
export interface IAuthController {
  login: ControllerMethod;
  logout: ControllerMethod;
  getCurrentUser: ControllerMethod;
}
