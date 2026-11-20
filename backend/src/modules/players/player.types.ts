import type { Types } from "mongoose";
import type { Asset } from "../../shared/types/common.types.js";
import type { PlayerPublicDTO, PlayerAdminDTO, PlayerResponseDTO } from "./player.dto.js";
import type { PlayerCreateInput, PlayerQueryInput, PlayerUpdateInput } from "./player.dto.js";

export type PlayerStatus = "active" | "inactive";

export interface PlayerFields {
  name: string;
  mobile: string | null;
  email: string | null;
  dateOfBirth: Date | null;
  profilePic: Asset | null;
  status: PlayerStatus;
  notes: string | null;
}
export interface PlayerEntity extends PlayerFields {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export interface PlayerListFilter {
  $or?: Array<
    | { name: { $regex: string; $options: "i" } }
    | { mobile: { $regex: string; $options: "i" } }
  >;
  name?: { $regex: string; $options: "i" };
  status?: PlayerStatus;
}
export type { IPlayerRepository, IPlayerService, IPlayerController } from "./player.interfaces.js";
export type { PlayerPublicDTO, PlayerAdminDTO, PlayerResponseDTO } from "./player.dto.js";
export type { PlayerCreateDTO, PlayerUpdateDTO, PlayerQueryDTO } from "./player.dto.js";
export type { PlayerCreateInput, PlayerQueryInput, PlayerUpdateInput } from "./player.dto.js";

export type PlayerStatisticsEntity = Pick<PlayerEntity, "_id" | "name" | "status" | "profilePic">;
