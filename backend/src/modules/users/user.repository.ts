import { UserModel, type UserRecord } from "./user.model.js";
import type { QueryFilter, UpdateQuery } from "mongoose";
import type { IUserRepository } from "./user.interfaces.js";
import type { SafeUserEntity, UserEntity } from "./user.types.js";
import type { AdminUserCreateDTO, CreateUserDto, UserListFilter } from "./user.dto.js";
import type { Asset } from "../../shared/types/common.types.js";

const safeProjection = "name email username mobile role profilePic status lastLoginAt createdAt updatedAt";

export class UserRepository implements IUserRepository {
  async findUserByEmail(email: string): Promise<UserEntity | null> {
    return UserModel.findOne({ email }).select("+passwordHash").lean<UserEntity>().exec();
  }

  async findUserById(userId: string): Promise<SafeUserEntity | null> {
    return UserModel.findById(userId).select(safeProjection).lean<SafeUserEntity>().exec();
  }

  async findUserByMobile(mobile: string): Promise<UserEntity | null> {
    return UserModel.findOne({ mobile }).select("+passwordHash").lean<UserEntity>().exec();
  }

  async findUserByUsername(username: string): Promise<UserEntity | null> {
    return UserModel.findOne({ username }).select("+passwordHash").lean<UserEntity>().exec();
  }

  async findUsers(filter: UserListFilter, page: number, limit: number): Promise<{ items: SafeUserEntity[]; total: number }> {
    const mongoFilter = filter as QueryFilter<UserRecord>;
    const [items, total] = await Promise.all([
      UserModel.find(mongoFilter).select(safeProjection).sort({ name: 1, _id: 1 })
        .skip((page - 1) * limit).limit(limit).lean<SafeUserEntity[]>().exec(),
      UserModel.countDocuments(mongoFilter).exec(),
    ]);
    return { items, total };
  }

  countActiveAdmins(): Promise<number> {
    return UserModel.countDocuments({ role: "admin", status: "active" }).exec();
  }

  async updateLastLoginAt(userId: string, at: Date): Promise<void> {
    await UserModel.updateOne({ _id: userId, status: "active" }, { $set: { lastLoginAt: at } }).exec();
  }

  async createAdminUser(data: AdminUserCreateDTO): Promise<SafeUserEntity> {
    const createdUser = await UserModel.create({
      name: data.name,
      email: data.email,
      ...(data.mobile ? { mobile: data.mobile } : {}),
      ...(data.username ? { username: data.username } : {}),
      passwordHash: data.passwordHash,
      role: "admin",
      profilePic: null,
      status: "active",
      lastLoginAt: null,
    });
    const savedUser = await this.findUserById(String(createdUser._id));
    if (!savedUser) throw new Error("Created administrator could not be retrieved");
    return savedUser;
  }

  async createUser(data: Omit<CreateUserDto, "password"> & { passwordHash: string; profilePic: Asset | null }): Promise<SafeUserEntity> {
    const createdUser = await UserModel.create({
      name: data.name,
      email: data.email,
      ...(data.mobile ? { mobile: data.mobile } : {}),
      ...(data.username ? { username: data.username } : {}),
      passwordHash: data.passwordHash,
      role: data.role ?? "user",
      profilePic: data.profilePic,
      status: data.status ?? "active",
      lastLoginAt: null,
    });
    const savedUser = await this.findUserById(String(createdUser._id));
    if (!savedUser) throw new Error("Created user could not be retrieved");
    return savedUser;
  }

  async updateUser(
    userId: string,
    data: Partial<{ name: string; email: string; mobile?: string | null; username?: string | null; passwordHash: string; role: "user" | "admin"; profilePic: Asset | null; status: "active" | "blocked" }>,
  ): Promise<SafeUserEntity | null> {
    const set: Record<string, unknown> = { ...data };
    const unset: Record<string, 1> = {};
    if (data.mobile === null) { delete set.mobile; unset.mobile = 1; }
    if (data.username === null) { delete set.username; unset.username = 1; }
    const update: UpdateQuery<UserRecord> = {};
    if (Object.keys(set).length) update.$set = set as UpdateQuery<UserRecord>["$set"];
    if (Object.keys(unset).length) update.$unset = unset as UpdateQuery<UserRecord>["$unset"];
    return UserModel.findByIdAndUpdate(userId, update, { returnDocument: "after", runValidators: true })
      .select(safeProjection).lean<SafeUserEntity>().exec();
  }

  async deleteUser(userId: string): Promise<boolean> {
    const deleted = await UserModel.findByIdAndDelete(userId).select("_id").lean().exec();
    return deleted !== null;
  }
}
