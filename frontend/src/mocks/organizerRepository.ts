import type { ApiResponse } from "@/types/api.types";
import type { AdminOrganizer, Organizer, OrganizerQuery, OrganizerWrite, PublicOrganizer } from "@/types/organizer.types";
import { readSeasonDb, commitSeasonDb } from "@/mocks/seasonStore";
import { isAdmin, requireAdmin } from "@/mocks/store";
import type { MockOrganizer } from "@/mocks/seasonSeed";
import { ApiError } from "@/utils/errorHandler";

let sequence = 9600;
const newId = () => (sequence++).toString(16).padStart(24, "0");
const now = () => new Date().toISOString();
const fail = (status: number, message: string): never => {
  throw new ApiError(status, message, { errorCode: status === 409 ? "CONFLICT" : "RULE" });
};
const toAdmin = (item: MockOrganizer): AdminOrganizer => ({
  _id: item._id, name: item.name, title: item.title, profilePic: item.profilePic,
  displayOrder: item.displayOrder, mobile: item.mobile, email: item.email,
  status: item.status, notes: item.notes, createdAt: item.createdAt, updatedAt: item.updatedAt,
});
const toPublic = (item: MockOrganizer): PublicOrganizer => ({
  _id: item._id, name: item.name, title: item.title, profilePic: item.profilePic,
  displayOrder: item.displayOrder,
});

export const organizerPreviewRepository = {
  async getOrganizers(query: OrganizerQuery = {}): Promise<ApiResponse<Organizer[]>> {
    const db = readSeasonDb();
    const admin = isAdmin();
    let items = db.organizers.filter((item) => admin || item.status === "active");
    if (query.search?.trim()) {
      const needle = query.search.trim().toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(needle) || item.title.toLowerCase().includes(needle));
    }
    if (query.title) items = items.filter((item) => item.title === query.title);
    if (admin && query.status) items = items.filter((item) => item.status === query.status);
    items.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const total = items.length;
    const data = items.slice((page - 1) * limit, page * limit);
    return {
      success: true, message: "Organizers loaded",
      data: data.map((item) => admin ? toAdmin(item) : toPublic(item)),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  async createOrganizer(input: OrganizerWrite): Promise<ApiResponse<AdminOrganizer>> {
    requireAdmin();
    const db = readSeasonDb();
    const date = now();
    const item: MockOrganizer = {
      _id: newId(), name: input.name.trim(), title: input.title.trim(),
      mobile: input.mobile?.trim() || null, email: input.email?.trim().toLowerCase() || null,
      profilePic: input.profilePic ?? null, displayOrder: input.displayOrder ?? 0,
      status: input.status ?? "active", notes: input.notes?.trim() || null,
      createdAt: date, updatedAt: date,
    };
    db.organizers.push(item);
    commitSeasonDb(db);
    return { success: true, message: "Organizer created", data: toAdmin(item) };
  },

  async updateOrganizer(id: string, input: Partial<OrganizerWrite>): Promise<ApiResponse<AdminOrganizer>> {
    requireAdmin();
    const db = readSeasonDb();
    const item = db.organizers.find((record) => record._id === id);
    if (!item) return fail(404, "Organizer not found");
    if (input.name !== undefined) item.name = input.name.trim();
    if (input.title !== undefined) item.title = input.title.trim();
    if (input.mobile !== undefined) item.mobile = input.mobile?.trim() || null;
    if (input.email !== undefined) item.email = input.email?.trim().toLowerCase() || null;
    if (input.profilePic !== undefined) item.profilePic = input.profilePic;
    if (input.displayOrder !== undefined) item.displayOrder = input.displayOrder;
    if (input.status !== undefined) item.status = input.status;
    if (input.notes !== undefined) item.notes = input.notes?.trim() || null;
    item.updatedAt = now();
    commitSeasonDb(db);
    return { success: true, message: "Organizer updated", data: toAdmin(item) };
  },

  async deleteOrganizer(id: string): Promise<ApiResponse<null>> {
    requireAdmin();
    const db = readSeasonDb();
    const index = db.organizers.findIndex((item) => item._id === id);
    if (index < 0) return fail(404, "Organizer not found");
    db.organizers.splice(index, 1);
    commitSeasonDb(db);
    return { success: true, message: "Organizer deleted", data: null };
  },
};
