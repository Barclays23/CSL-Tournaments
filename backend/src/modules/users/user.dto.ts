import type { Asset } from "../../shared/types/common.types.js";
import type { UserRole, UserStatus } from "./user.types.js";

/** Input contract used only by the first-admin seed workflow. */
export interface CreateAdminUserRequestDto {
  name: string;
  email: string;
  mobile?: string | null;
  username?: string;
  password: string;
}
export type AdminUserCreateInput = CreateAdminUserRequestDto;
export type AdminUserCreateDTO = Omit<CreateAdminUserRequestDto, "password"> & { passwordHash: string };

export interface CreateUserDto {
  name: string;
  email: string;
  mobile?: string | null;
  username?: string | null;
  password: string;
  role?: UserRole;
  status?: UserStatus;
  profilePic?: Asset | null;
}
export interface UpdateUserDto {
  name?: string;
  email?: string;
  mobile?: string | null;
  username?: string | null;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
  profilePic?: Asset | null;
}
export interface UserQueryDto {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}
export interface UserListFilter {
  role?: UserRole;
  status?: UserStatus;
  $or?: Array<Record<string, unknown>>;
}
export interface UserResponseDTO {
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
export interface AuthenticatedUserDTO {
  _id: string;
  name: string;
  email: string;
  mobile: string | null;
  username: string | null;
  role: UserRole;
  status: UserStatus;
  profilePic: Asset | null;
}
export type AdminUserDTO = AuthenticatedUserDTO;
