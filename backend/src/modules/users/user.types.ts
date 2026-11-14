import type { Types } from "mongoose";
import type { Asset } from "../../shared/types/common.types.js";
import type { UserListFilter } from "./user.dto.js";

export type UserStatus = "active" | "blocked";
export type UserRole = "user" | "admin";

export interface UserFields {
  name: string;
  email: string;
  mobile?: string | null;
  username?: string | null;
  passwordHash: string;
  role: UserRole;
  profilePic: Asset | null;
  status: UserStatus;
  lastLoginAt: Date | null;
}

export interface UserEntity extends UserFields {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeUserEntity extends Omit<UserEntity, "passwordHash"> {}
export type { UserListFilter };

export type { IUserRepository, IUserService } from "./user.interfaces.js";
export type { AdminUserDTO, UserResponseDTO } from "./user.dto.js";
export type { AdminUserCreateDTO } from "./user.dto.js";
