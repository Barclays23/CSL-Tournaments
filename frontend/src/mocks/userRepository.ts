import type { ApiResponse } from "@/types/api.types";
import type { User, UserQuery, UserWrite } from "@/types/user.types";
import { readSeasonDb, commitSeasonDb } from "@/mocks/seasonStore";
import { requireAdmin } from "@/mocks/store";
import type { MockUser } from "@/mocks/seasonSeed";
import { ApiError } from "@/utils/errorHandler";

let sequence = 9700;
const newId = () => (sequence++).toString(16).padStart(24, "0");
const now = () => new Date().toISOString();
// Mock-only placeholder. Real password hashing is performed exclusively by the backend.
const MOCK_PASSWORD_HASH = "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi";
const fail = (status: number, message: string): never => {
  throw new ApiError(status, message, { errorCode: status === 409 ? "CONFLICT" : "RULE" });
};
const toUser = (item: MockUser): User => ({
  _id: item._id, name: item.name, email: item.email, mobile: item.mobile ?? null,
  username: item.username ?? null, role: item.role, profilePic: item.profilePic,
  status: item.status, lastLoginAt: item.lastLoginAt, createdAt: item.createdAt, updatedAt: item.updatedAt,
});
function assertUnique(db: ReturnType<typeof readSeasonDb>, input: Partial<UserWrite>, exceptId?: string) {
  const email = input.email?.trim().toLowerCase();
  const username = input.username?.trim().toLowerCase() || null;
  const mobile = input.mobile?.trim() || null;
  if (email && db.users.some((u) => u.email.toLowerCase() === email && u._id !== exceptId)) return fail(409, "A user with this email already exists");
  if (username && db.users.some((u) => u.username?.toLowerCase() === username && u._id !== exceptId)) return fail(409, "A user with this username already exists");
  if (mobile && db.users.some((u) => u.mobile === mobile && u._id !== exceptId)) return fail(409, "A user with this mobile number already exists");
}

export const userPreviewRepository = {
  async getUsers(query: UserQuery = {}): Promise<ApiResponse<User[]>> {
    requireAdmin();
    const db = readSeasonDb();
    let items = [...db.users];
    if (query.search?.trim()) {
      const needle = query.search.trim().toLowerCase();
      items = items.filter((u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || (u.mobile ?? "").includes(needle));
    }
    if (query.role) items = items.filter((u) => u.role === query.role);
    if (query.status) items = items.filter((u) => u.status === query.status);
    items.sort((a, b) => a.name.localeCompare(b.name));
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const total = items.length;
    return { success: true, message: "Users loaded", data: items.slice((page - 1) * limit, page * limit).map(toUser), pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  },
  async createUser(input: UserWrite): Promise<ApiResponse<User>> {
    requireAdmin();
    if (!input.password || input.password.length < 10) return fail(422, "A password of at least 10 characters is required");
    const db = readSeasonDb();
    assertUnique(db, input);
    const date = now();
    const item: MockUser = {
      _id: newId(), name: input.name.trim(), email: input.email.trim().toLowerCase(),
      username: input.username?.trim().toLowerCase() || undefined, mobile: input.mobile?.trim() || undefined,
      passwordHash: MOCK_PASSWORD_HASH, role: input.role, profilePic: input.profilePic ?? null,
      status: input.status, lastLoginAt: null, createdAt: date, updatedAt: date,
    };
    db.users.push(item);
    commitSeasonDb(db);
    return { success: true, message: "User created", data: toUser(item) };
  },
  async updateUser(id: string, input: Partial<UserWrite>): Promise<ApiResponse<User>> {
    requireAdmin();
    const db = readSeasonDb();
    const item = db.users.find((u) => u._id === id);
    if (!item) return fail(404, "User not found");
    assertUnique(db, input, id);
    if (input.name !== undefined) item.name = input.name.trim();
    if (input.email !== undefined) item.email = input.email.trim().toLowerCase();
    if (input.username !== undefined) item.username = input.username?.trim().toLowerCase() || undefined;
    if (input.mobile !== undefined) item.mobile = input.mobile?.trim() || undefined;
    if (input.password !== undefined) {
      if (input.password.length < 10) return fail(422, "Password must contain at least 10 characters");
      item.passwordHash = MOCK_PASSWORD_HASH;
    }
    if (input.role !== undefined) item.role = input.role;
    if (input.profilePic !== undefined) item.profilePic = input.profilePic;
    if (input.status !== undefined) item.status = input.status;
    item.updatedAt = now();
    commitSeasonDb(db);
    return { success: true, message: "User updated", data: toUser(item) };
  },
  async updateUserStatus(id: string, status: "active" | "blocked"): Promise<ApiResponse<User>> {
    requireAdmin();
    const db = readSeasonDb();
    const item = db.users.find((u) => u._id === id);
    if (!item) return fail(404, "User not found");
    item.status = status;
    item.updatedAt = now();
    commitSeasonDb(db);
    return { success: true, message: "User status updated", data: toUser(item) };
  },
  async deleteUser(id: string): Promise<ApiResponse<null>> {
    requireAdmin();
    const db = readSeasonDb();
    const index = db.users.findIndex((u) => u._id === id);
    if (index < 0) return fail(404, "User not found");
    if (db.users[index].role === "admin" && db.users.filter((u) => u.role === "admin" && u.status === "active").length <= 1) return fail(409, "Cannot delete the last active administrator");
    db.users.splice(index, 1);
    commitSeasonDb(db);
    return { success: true, message: "User deleted", data: null };
  },
};
