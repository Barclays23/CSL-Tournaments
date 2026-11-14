import type { ControllerMethod } from "../../shared/types/common.types.js";
import type { CreateOrganizerDto, UpdateOrganizerDto, OrganizerQueryDto, OrganizerResponseDTO, AdminOrganizerDTO } from "./organizer.dto.js";
import type { OrganizerEntity, OrganizerListFilter } from "./organizer.types.js";

export interface IOrganizerRepository {
  findOrganizers(filter: OrganizerListFilter, page: number, limit: number): Promise<{ items: OrganizerEntity[]; total: number }>;
  findOrganizerById(id: string): Promise<OrganizerEntity | null>;
  createOrganizer(data: OrganizerEntityInput): Promise<OrganizerEntity>;
  updateOrganizer(id: string, data: Partial<OrganizerEntityInput>): Promise<OrganizerEntity | null>;
  deleteOrganizer(id: string): Promise<boolean>;
}
export type OrganizerEntityInput = Omit<OrganizerEntity, "_id" | "createdAt" | "updatedAt">;

export interface IOrganizerService {
  getOrganizers(query: OrganizerQueryDto, isAdmin: boolean): Promise<{ items: OrganizerResponseDTO[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>;
  getOrganizerById(id: string, isAdmin: boolean): Promise<OrganizerResponseDTO>;
  createOrganizer(input: CreateOrganizerDto): Promise<AdminOrganizerDTO>;
  updateOrganizer(id: string, input: UpdateOrganizerDto): Promise<AdminOrganizerDTO>;
  deleteOrganizer(id: string): Promise<void>;
}
export interface IOrganizerController {
  list: ControllerMethod;
  get: ControllerMethod;
  create: ControllerMethod;
  update: ControllerMethod;
  delete: ControllerMethod;
}
