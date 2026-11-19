import type { ManagerFields, ManagerEntity, AdminManagerDTO, ManagerResponseDTO, ManagerCreateDTO, ManagerUpdateDTO, ManagerQueryDTO, ManagerListFilter } from "./manager.types.js";
import type { ControllerMethod, PaginatedResult } from "../../shared/types/common.types.js";

export interface IManagerRepository {
  findManagers(filter: ManagerListFilter, page: number, limit: number): Promise<{ items: ManagerEntity[]; total: number }>;
  findManagerById(managerId: string): Promise<ManagerEntity | null>;
  findManagerByMobile(mobile: string): Promise<ManagerEntity | null>;
  findManagerByEmail(email: string): Promise<ManagerEntity | null>;
  createManager(data: ManagerFields): Promise<ManagerEntity>;
  updateManager(managerId: string, data: Partial<ManagerFields>): Promise<ManagerEntity | null>;
  countSeasonTeamAssignments(managerId: string): Promise<number>;
  deleteManager(managerId: string): Promise<boolean>;
}

export interface IManagerService {
  getManagers(query: ManagerQueryDTO, isAdmin: boolean): Promise<PaginatedResult<ManagerResponseDTO>>;
  getManagerById(managerId: string, isAdmin: boolean): Promise<ManagerResponseDTO>;
  createManager(input: ManagerCreateDTO): Promise<AdminManagerDTO>;
  updateManager(managerId: string, input: ManagerUpdateDTO): Promise<AdminManagerDTO>;
  deleteManager(managerId: string): Promise<void>;
}

export interface IManagerController {
  getManagers: ControllerMethod;
  getManagerById: ControllerMethod;
  createManager: ControllerMethod;
  updateManager: ControllerMethod;
  deleteManager: ControllerMethod;
}
