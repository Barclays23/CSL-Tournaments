import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { appConfig } from "../../config/env.config.js";
import { AppError } from "../../shared/errors/appError.js";
import { normalizeEmail } from "../../shared/utils/normalizeInput.js";
import type { IUserRepository, IUserService } from "./user.interfaces.js";
import type { AdminUserDTO, AuthenticatedUserDTO, CreateUserDto, UpdateUserDto, UserListFilter, UserQueryDto, UserResponseDTO } from "./user.dto.js";
import type { SafeUserEntity, UserRole, UserStatus } from "./user.types.js";

export class UserService implements IUserService {
  constructor(private readonly _userRepository: IUserRepository) {}

  async createInitialAdmin(): Promise<void> {
    if (!appConfig.ADMIN_EMAIL || !appConfig.ADMIN_PASSWORD) {
      console.warn("ADMIN_EMAIL/ADMIN_PASSWORD not set; skipping admin seed");
      return;
    }
    const email = normalizeEmail(appConfig.ADMIN_EMAIL)!;
    const mobile = appConfig.ADMIN_MOBILE.trim().replace(/^\+?91(?=\d{10}$)/, "") || undefined;
    const username = appConfig.ADMIN_USERNAME?.trim().toLowerCase() || undefined;
    if (await this._userRepository.findUserByEmail(email)) {
      console.log("Admin already exists; seed skipped");
      return;
    }
    if (username && await this._userRepository.findUserByUsername(username)) {
      throw new AppError(`Seed aborted: username "${username}" is already taken`, 409, "USERNAME_CONFLICT");
    }
    if (mobile && await this._userRepository.findUserByMobile(mobile)) {
      throw new AppError("Seed aborted: mobile is already registered", 409, "MOBILE_CONFLICT");
    }
    const passwordHash = await bcrypt.hash(appConfig.ADMIN_PASSWORD, 12);
    await this._userRepository.createAdminUser({
      name: appConfig.ADMIN_NAME.trim(), email, passwordHash,
      ...(mobile ? { mobile } : {}), ...(username ? { username } : {}),
    });
    console.log("Administrator account created");
  }

  async getAdminUserById(userId: string): Promise<AdminUserDTO> {
    const user = await this.getCurrentUserById(userId);
    if (user.role !== "admin") throw new AppError("Administrator privileges required", 403, "FORBIDDEN");
    return user;
  }

  async getCurrentUserById(userId: string): Promise<AuthenticatedUserDTO> {
    this.ensureId(userId);
    const user = await this._userRepository.findUserById(userId);
    if (!user) throw new AppError("User account not found", 404, "USER_NOT_FOUND");
    if (user.status !== "active") throw new AppError("User account is blocked", 403, "ACCOUNT_INACTIVE");
    return this.mapAuthUser(user);
  }

  async listUsers(query: UserQueryDto) {
    const filter: UserListFilter = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;
    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
        { username: { $regex: escaped, $options: "i" } },
        { mobile: { $regex: escaped, $options: "i" } },
      ];
    }
    const result = await this._userRepository.findUsers(filter, query.page, query.limit);
    return {
      items: result.items.map((user) => this.mapUser(user)),
      pagination: { page: query.page, limit: query.limit, total: result.total, totalPages: Math.ceil(result.total / query.limit) },
    };
  }

  async createUserByAdmin(input: CreateUserDto): Promise<UserResponseDTO> {
    const email = normalizeEmail(input.email)!;
    const username = input.username?.trim().toLowerCase() || null;
    const mobile = input.mobile?.trim().replace(/^\+?91(?=\d{10}$)/, "") || null;
    await this.assertUnique(email, mobile, username);
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      const created = await this._userRepository.createUser({
        name: input.name.trim(), email, mobile, username, passwordHash,
        role: input.role ?? "user", status: input.status ?? "active", profilePic: input.profilePic ?? null,
      });
      return this.mapUser(created);
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async updateUser(userId: string, input: UpdateUserDto, actorId: string): Promise<UserResponseDTO> {
    this.ensureId(userId);
    const existing = await this._userRepository.findUserById(userId);
    if (!existing) throw new AppError("User not found", 404, "USER_NOT_FOUND");
    if (userId === actorId && (input.status === "blocked" || input.role === "user")) {
      throw new AppError("You cannot block or demote your own account", 409, "SELF_ACCOUNT_CHANGE");
    }

    const update: Partial<{ name: string; email: string; mobile?: string | null; username?: string | null; passwordHash: string; role: UserRole; profilePic: import("../../shared/types/common.types.js").Asset | null; status: UserStatus }> = {};
    if (input.name !== undefined) update.name = input.name.trim();
    if (input.email !== undefined) {
      const email = normalizeEmail(input.email)!;
      if (email !== existing.email) await this.assertUnique(email, null, null, userId);
      update.email = email;
    }
    if (input.mobile !== undefined) {
      const mobile = input.mobile?.trim().replace(/^\+?91(?=\d{10}$)/, "") || null;
      if (mobile && mobile !== existing.mobile) await this.assertUnique("", mobile, null, userId);
      update.mobile = mobile;
    }
    if (input.username !== undefined) {
      const username = input.username?.trim().toLowerCase() || null;
      if (username && username !== existing.username) await this.assertUnique("", null, username, userId);
      update.username = username;
    }
    if (input.password) update.passwordHash = await bcrypt.hash(input.password, 12);
    if (input.role !== undefined) update.role = input.role;
    if (input.status !== undefined) update.status = input.status;
    if (input.profilePic !== undefined) update.profilePic = input.profilePic;

    const removesAdmin = existing.role === "admin" && existing.status === "active"
      && (update.role === "user" || update.status === "blocked");
    if (removesAdmin && await this._userRepository.countActiveAdmins() <= 1) {
      throw new AppError("At least one active administrator must remain", 409, "LAST_ADMIN");
    }

    try {
      const updated = await this._userRepository.updateUser(userId, update);
      if (!updated) throw new AppError("User not found", 404, "USER_NOT_FOUND");
      return this.mapUser(updated);
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async updateUserStatus(userId: string, status: UserStatus, actorId: string): Promise<UserResponseDTO> {
    return this.updateUser(userId, { status }, actorId);
  }

  async deleteUser(userId: string, actorId: string): Promise<void> {
    this.ensureId(userId);
    if (userId === actorId) throw new AppError("You cannot delete your own account", 409, "SELF_ACCOUNT_DELETE");
    const existing = await this._userRepository.findUserById(userId);
    if (!existing) throw new AppError("User not found", 404, "USER_NOT_FOUND");
    if (existing.role === "admin" && existing.status === "active" && await this._userRepository.countActiveAdmins() <= 1) {
      throw new AppError("At least one active administrator must remain", 409, "LAST_ADMIN");
    }
    if (!(await this._userRepository.deleteUser(userId))) throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  private async assertUnique(email: string, mobile: string | null, username: string | null, excludeId?: string): Promise<void> {
    const [byEmail, byMobile, byUsername] = await Promise.all([
      email ? this._userRepository.findUserByEmail(email) : Promise.resolve(null),
      mobile ? this._userRepository.findUserByMobile(mobile) : Promise.resolve(null),
      username ? this._userRepository.findUserByUsername(username) : Promise.resolve(null),
    ]);
    if (byEmail && String(byEmail._id) !== excludeId) throw new AppError("Email already exists", 409, "DUPLICATE_EMAIL", { email: "Email already exists" });
    if (byMobile && String(byMobile._id) !== excludeId) throw new AppError("Mobile already exists", 409, "DUPLICATE_MOBILE", { mobile: "Mobile already exists" });
    if (byUsername && String(byUsername._id) !== excludeId) throw new AppError("Username already exists", 409, "DUPLICATE_USERNAME", { username: "Username already exists" });
  }

  private mapUser(user: SafeUserEntity): UserResponseDTO {
    return {
      _id: String(user._id), name: user.name, email: user.email, mobile: user.mobile ?? null,
      username: user.username ?? null, role: user.role, profilePic: user.profilePic ?? null,
      status: user.status, lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(),
    };
  }

  private mapAuthUser(user: SafeUserEntity): AuthenticatedUserDTO {
    return {
      _id: String(user._id), name: user.name, email: user.email, mobile: user.mobile ?? null,
      username: user.username ?? null, role: user.role, status: user.status, profilePic: user.profilePic ?? null,
    };
  }

  private ensureId(id: string): void {
    if (!Types.ObjectId.isValid(id)) throw new AppError("Invalid user ID", 400, "INVALID_ID");
  }

  private rethrowDuplicate(error: unknown): never {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000) {
      throw new AppError("A user with this email, mobile or username already exists", 409, "DUPLICATE_USER");
    }
    throw error;
  }
}
