import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import type { IOrganizerRepository, IOrganizerService, OrganizerEntityInput } from "./organizer.interfaces.js";
import type { CreateOrganizerDto, UpdateOrganizerDto, OrganizerQueryDto, OrganizerResponseDTO, PublicOrganizerDTO, AdminOrganizerDTO } from "./organizer.dto.js";
import type { OrganizerEntity, OrganizerListFilter } from "./organizer.types.js";

export class OrganizerService implements IOrganizerService {
  constructor(private readonly repository: IOrganizerRepository) {}

  async getOrganizers(query: OrganizerQueryDto, isAdmin: boolean) {
    const filter: OrganizerListFilter = {};
    if (isAdmin && query.status) filter.status = query.status;
    else if (!isAdmin) filter.status = "active";
    if (query.search) {
      const escaped = query.search.replace(/[.*+?^\u0024{}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { title: { $regex: escaped, $options: "i" } },
      ];
    }
    if (query.title) filter.title = { $regex: query.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const result = await this.repository.findOrganizers(filter, query.page, query.limit);
    return {
      items: result.items.map((item) => this.toResponse(item, isAdmin)),
      pagination: { page: query.page, limit: query.limit, total: result.total, totalPages: Math.ceil(result.total / query.limit) },
    };
  }

  async getOrganizerById(id: string, isAdmin: boolean): Promise<OrganizerResponseDTO> {
    this.ensureId(id);
    const organizer = await this.repository.findOrganizerById(id);
    if (!organizer || (!isAdmin && organizer.status !== "active")) {
      throw new AppError("Organizer not found", 404, "ORGANIZER_NOT_FOUND");
    }
    return this.toResponse(organizer, isAdmin);
  }

  async createOrganizer(input: CreateOrganizerDto): Promise<AdminOrganizerDTO> {
    const data: OrganizerEntityInput = {
      name: input.name.trim(), title: input.title.trim(),
      mobile: input.mobile?.trim() || null, email: input.email?.trim().toLowerCase() || null,
      profilePic: input.profilePic ?? null, displayOrder: input.displayOrder ?? 0,
      status: input.status ?? "active", notes: input.notes?.trim() || null,
    };
    return this.toAdmin(await this.repository.createOrganizer(data));
  }

  async updateOrganizer(id: string, input: UpdateOrganizerDto): Promise<AdminOrganizerDTO> {
    this.ensureId(id);
    const current = await this.repository.findOrganizerById(id);
    if (!current) throw new AppError("Organizer not found", 404, "ORGANIZER_NOT_FOUND");
    const update: Partial<OrganizerEntityInput> = {};
    if (input.name !== undefined) update.name = input.name.trim();
    if (input.title !== undefined) update.title = input.title.trim();
    if (input.mobile !== undefined) update.mobile = input.mobile?.trim() || null;
    if (input.email !== undefined) update.email = input.email?.trim().toLowerCase() || null;
    if (input.profilePic !== undefined) update.profilePic = input.profilePic;
    if (input.displayOrder !== undefined) update.displayOrder = input.displayOrder;
    if (input.status !== undefined) update.status = input.status;
    if (input.notes !== undefined) update.notes = input.notes?.trim() || null;
    const updated = await this.repository.updateOrganizer(id, update);
    if (!updated) throw new AppError("Organizer not found", 404, "ORGANIZER_NOT_FOUND");
    return this.toAdmin(updated);
  }

  async deleteOrganizer(id: string): Promise<void> {
    this.ensureId(id);
    if (!(await this.repository.deleteOrganizer(id))) throw new AppError("Organizer not found", 404, "ORGANIZER_NOT_FOUND");
  }

  private toResponse(item: OrganizerEntity, isAdmin: boolean): OrganizerResponseDTO {
    return isAdmin ? this.toAdmin(item) : this.toPublic(item);
  }
  private toPublic(item: OrganizerEntity): PublicOrganizerDTO {
    return { _id: String(item._id), name: item.name, title: item.title, profilePic: item.profilePic ?? null, displayOrder: item.displayOrder };
  }
  private toAdmin(item: OrganizerEntity): AdminOrganizerDTO {
    return { ...this.toPublic(item), mobile: item.mobile ?? null, email: item.email ?? null, status: item.status, notes: item.notes ?? null,
      createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
  }
  private ensureId(id: string): void {
    if (!Types.ObjectId.isValid(id)) throw new AppError("Invalid organizer ID", 400, "INVALID_ID");
  }
}
