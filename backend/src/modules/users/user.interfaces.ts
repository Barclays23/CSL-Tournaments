import type { UserEntity, SafeUserEntity } from "./user.types.js";
import type { AdminUserCreateDTO, AdminUserDTO, AuthenticatedUserDTO, CreateUserDto, UpdateUserDto, UserQueryDto, UserResponseDTO, UserListFilter } from "./user.dto.js";
import type { Asset } from "../../shared/types/common.types.js";

export interface IUserRepository {
  findUserByEmail(email: string): Promise<UserEntity | null>;
  findUserByMobile(mobile: string): Promise<UserEntity | null>;
  findUserByUsername(username: string): Promise<UserEntity | null>;
  findUserById(userId: string): Promise<SafeUserEntity | null>;
  findUsers(filter: UserListFilter, page: number, limit: number): Promise<{ items: SafeUserEntity[]; total: number }>;
  countActiveAdmins(): Promise<number>;
  updateLastLoginAt(userId: string, at: Date): Promise<void>;
  createAdminUser(data: AdminUserCreateDTO): Promise<SafeUserEntity>;
  createUser(data: Omit<CreateUserDto, "password"> & { passwordHash: string; profilePic: Asset | null }): Promise<SafeUserEntity>;
  updateUser(userId: string, data: Partial<{ name: string; email: string; mobile?: string | null; username?: string | null; passwordHash: string; role: "user" | "admin"; profilePic: Asset | null; status: "active" | "blocked" }>): Promise<SafeUserEntity | null>;
  deleteUser(userId: string): Promise<boolean>;
}

export interface IUserService {
  createInitialAdmin(): Promise<void>;
  getAdminUserById(userId: string): Promise<AdminUserDTO>;
  getCurrentUserById(userId: string): Promise<AuthenticatedUserDTO>;
  listUsers(query: UserQueryDto): Promise<{ items: UserResponseDTO[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>;
  createUser(input: CreateUserDto): Promise<UserResponseDTO>;
  updateUser(userId: string, input: UpdateUserDto, actorId: string): Promise<UserResponseDTO>;
  updateUserStatus(userId: string, status: "active" | "blocked", actorId: string): Promise<UserResponseDTO>;
  deleteUser(userId: string, actorId: string): Promise<void>;
}

export interface IUserController {
  list: import("../../shared/types/common.types.js").ControllerMethod;
  create: import("../../shared/types/common.types.js").ControllerMethod;
  update: import("../../shared/types/common.types.js").ControllerMethod;
  updateStatus: import("../../shared/types/common.types.js").ControllerMethod;
  delete: import("../../shared/types/common.types.js").ControllerMethod;
}
