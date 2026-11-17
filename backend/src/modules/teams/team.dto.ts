import type { Asset } from "../../shared/types/common.types.js";
import type { TeamStatus } from "./team.types.js";

export interface CreateTeamDto {
  name: string;
  shortName?: string | null;
  description?: string | null;
  logo?: Asset | null;
  poster?: Asset | null;
  status: TeamStatus;
}
export type UpdateTeamDto = Partial<CreateTeamDto>;
export interface TeamQueryDto {
  page: number;
  limit: number;
  search?: string;
  status?: TeamStatus;
}
export type TeamCreateInput = CreateTeamDto;
export type TeamUpdateInput = UpdateTeamDto;
export type TeamQueryInput = TeamQueryDto;
export type TeamCreateDTO = CreateTeamDto;
export type TeamUpdateDTO = UpdateTeamDto;
export type TeamQueryDTO = TeamQueryDto;

import type { TeamFields } from "./team.types.js";

export interface TeamBriefDTO {
  _id: string;
  name: string;
  shortName: string | null;
  logo: Asset | null;
}

export interface TeamDTO extends TeamFields {
  _id: string;
  createdAt: string;
  updatedAt: string;
}

