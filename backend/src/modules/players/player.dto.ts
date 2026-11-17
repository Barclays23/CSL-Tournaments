import type { Asset } from "../../shared/types/common.types.js";
import type { PlayerStatus } from "./player.types.js";

export interface CreatePlayerDto {
  name: string;
  mobile?: string | null;
  email?: string | null;
  dateOfBirth?: Date | null;
  profilePic?: Asset | null;
  status: PlayerStatus;
  notes?: string | null;
}
export type UpdatePlayerDto = Partial<CreatePlayerDto>;
export interface PlayerQueryDto {
  page: number;
  limit: number;
  search?: string;
  status?: PlayerStatus;
}
export type PlayerCreateInput = CreatePlayerDto;
export type PlayerUpdateInput = UpdatePlayerDto;
export type PlayerQueryInput = PlayerQueryDto;
export type PlayerCreateDTO = CreatePlayerDto;
export type PlayerUpdateDTO = UpdatePlayerDto;
export type PlayerQueryDTO = PlayerQueryDto;

export interface PlayerPublicDTO {
  _id: string;
  name: string;
  profilePic: Asset | null;
  status: PlayerStatus;
}
export interface PlayerAdminDTO extends PlayerPublicDTO {
  mobile: string | null;
  email: string | null;
  dateOfBirth: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
export type PlayerResponseDTO = PlayerPublicDTO | PlayerAdminDTO;
