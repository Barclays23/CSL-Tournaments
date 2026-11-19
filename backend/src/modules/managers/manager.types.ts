import type { Types } from "mongoose";
import type { Asset } from "../../shared/types/common.types.js";

export type ManagerStatus = "active" | "inactive";

export interface ManagerFields {
  name: string;
  mobile: string;
  email: string | null;
  dateOfBirth: Date | null;
  role: string | null;
  profilePic: Asset | null;
  status: ManagerStatus;
}

export interface ManagerEntity extends ManagerFields {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagerListFilter {
  name?: { $regex: string; $options: "i" };
  status?: ManagerStatus;
}

export type { IManagerRepository, IManagerService, IManagerController } from "./manager.interfaces.js";
export type { PublicManagerDTO, AdminManagerDTO, ManagerResponseDTO } from "./manager.dto.js";
export type { ManagerCreateDTO, ManagerUpdateDTO, ManagerQueryDTO } from "./manager.dto.js";
