import type { Asset } from "../../shared/types/common.types.js";
import type { ManagerStatus } from "./manager.types.js";

export interface CreateManagerDto {
  name: string;
  mobile: string;
  email?: string | null;
  dateOfBirth?: Date | null;
  role?: string | null;
  profilePic?: Asset | null;
  status?: ManagerStatus;
}
export type UpdateManagerDto = Partial<CreateManagerDto>;
export interface ManagerQueryDto {
  page: number;
  limit: number;
  search?: string;
  status?: ManagerStatus;
}

export type ManagerCreateInput = CreateManagerDto;
export type ManagerUpdateInput = UpdateManagerDto;
export type ManagerQueryInput = ManagerQueryDto;
export type ManagerCreateDTO = CreateManagerDto;
export type ManagerUpdateDTO = UpdateManagerDto;
export type ManagerQueryDTO = ManagerQueryDto;

export interface PublicManagerDTO {
  _id: string;
  name: string;
  role: string | null;
  profilePic: Asset | null;
  status: ManagerStatus;
}
export interface AdminManagerDTO extends PublicManagerDTO {
  mobile: string;
  email: string | null;
  dateOfBirth: string | null;
}
export type ManagerResponseDTO = PublicManagerDTO | AdminManagerDTO;
