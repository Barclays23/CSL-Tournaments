import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import { normalizeEmail, normalizeMobile } from "../../shared/utils/normalizeInput.js";
import type { IManagerService, IManagerRepository } from "./manager.interfaces.js";
import type { AdminManagerDTO, ManagerCreateDTO, ManagerEntity, ManagerFields, ManagerListFilter, ManagerQueryDTO, ManagerResponseDTO, ManagerUpdateDTO, PublicManagerDTO } from "./manager.types.js";
import type { PaginatedResult } from "../../shared/types/common.types.js";

export class ManagerService implements IManagerService {
  constructor(private readonly _managerRepository: IManagerRepository) {}

  async getManagers(query: ManagerQueryDTO, isAdmin: boolean): Promise<PaginatedResult<ManagerResponseDTO>> {
    const filter: ManagerListFilter = {};
    if (query.search) filter.name = { $regex: query.search, $options: "i" };
    if (isAdmin && query.status) filter.status = query.status;
    else if (!isAdmin) filter.status = "active";

    const result = await this._managerRepository.findManagers(filter, query.page, query.limit);
    return {
      items: result.items.map((manager) => this.mapManagerToResponseDTO(manager, isAdmin)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  async getManagerById(managerId: string, isAdmin: boolean): Promise<ManagerResponseDTO> {
    this.ensureValidManagerId(managerId);
    const manager = await this._managerRepository.findManagerById(managerId);
    if (!manager || (!isAdmin && manager.status !== "active")) {
      throw new AppError("Manager not found", 404, "NOT_FOUND");
    }
    return this.mapManagerToResponseDTO(manager, isAdmin);
  }

  async createManager(input: ManagerCreateDTO): Promise<AdminManagerDTO> {
    const mobile = normalizeMobile(input.mobile);
    const email = normalizeEmail(input.email);
    await this.ensureManagerContactDetailsAreUnique(mobile, email);

    const managerFields: ManagerFields = {
      name: input.name.trim(),
      mobile,
      email,
      dateOfBirth: input.dateOfBirth ?? null,
      role: input.role?.trim() || null,
      profilePic: input.profilePic ?? null,
      status: input.status ?? "active",
    };

    const createdManager = await this._managerRepository.createManager(managerFields);
    return this.mapManagerToAdminDTO(createdManager);
  }

  async updateManager(managerId: string, input: ManagerUpdateDTO): Promise<AdminManagerDTO> {
    this.ensureValidManagerId(managerId);
    const existingManager = await this._managerRepository.findManagerById(managerId);
    if (!existingManager) throw new AppError("Manager not found", 404, "NOT_FOUND");

    const updateData: Partial<ManagerFields> = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.mobile !== undefined) {
      const mobile = normalizeMobile(input.mobile);
      if (mobile !== existingManager.mobile) await this.ensureManagerMobileIsUnique(mobile);
      updateData.mobile = mobile;
    }
    if (input.email !== undefined) {
      const email = normalizeEmail(input.email);
      if (email && email !== existingManager.email) await this.ensureManagerEmailIsUnique(email);
      updateData.email = email;
    }
    if (input.dateOfBirth !== undefined) updateData.dateOfBirth = input.dateOfBirth;
    if (input.role !== undefined) updateData.role = input.role?.trim() || null;
    if (input.profilePic !== undefined) updateData.profilePic = input.profilePic;
    if (input.status !== undefined) updateData.status = input.status;

    const updatedManager = await this._managerRepository.updateManager(managerId, updateData);
    if (!updatedManager) throw new AppError("Manager not found", 404, "NOT_FOUND");
    return this.mapManagerToAdminDTO(updatedManager);
  }

  async deleteManager(managerId: string): Promise<void> {
    this.ensureValidManagerId(managerId);
    const deleted = await this._managerRepository.deleteManager(managerId);
    if (!deleted) throw new AppError("Manager not found", 404, "NOT_FOUND");
  }

  private async ensureManagerContactDetailsAreUnique(mobile: string, email: string | null): Promise<void> {
    await this.ensureManagerMobileIsUnique(mobile);
    if (email) await this.ensureManagerEmailIsUnique(email);
  }

  private async ensureManagerMobileIsUnique(mobile: string): Promise<void> {
    if (await this._managerRepository.findManagerByMobile(mobile)) {
      throw new AppError("Mobile already exists", 409, "DUPLICATE_MOBILE", { mobile: "Mobile already exists" });
    }
  }

  private async ensureManagerEmailIsUnique(email: string): Promise<void> {
    if (await this._managerRepository.findManagerByEmail(email)) {
      throw new AppError("Email already exists", 409, "DUPLICATE_EMAIL", { email: "Email already exists" });
    }
  }

  private mapManagerToResponseDTO(manager: ManagerEntity, isAdmin: boolean): ManagerResponseDTO {
    return isAdmin ? this.mapManagerToAdminDTO(manager) : this.mapManagerToPublicDTO(manager);
  }

  private mapManagerToPublicDTO(manager: ManagerEntity): PublicManagerDTO {
    return {
      _id: String(manager._id),
      name: manager.name,
      role: manager.role,
      profilePic: manager.profilePic,
      status: manager.status,
    };
  }

  private mapManagerToAdminDTO(manager: ManagerEntity): AdminManagerDTO {
    return {
      ...this.mapManagerToPublicDTO(manager),
      mobile: manager.mobile,
      email: manager.email,
      dateOfBirth: manager.dateOfBirth?.toISOString() ?? null,
    };
  }

  private ensureValidManagerId(managerId: string): void {
    if (!Types.ObjectId.isValid(managerId)) throw new AppError("Invalid manager ID", 400, "INVALID_ID");
  }
}
