import type { Types } from "mongoose";
import type { TeamBriefDTO, TeamDTO } from "./team.dto.js";
import type { Asset } from "../../shared/types/common.types.js";
import type { TeamCreateInput, TeamQueryInput, TeamUpdateInput } from "./team.dto.js";

export type TeamStatus = "active" | "inactive";

export interface TeamFields {
  name: string;
  shortName: string | null;
  description: string | null;
  logo: Asset | null;
  poster: Asset | null;
  status: TeamStatus;
}

export interface TeamEntity extends TeamFields {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamBriefEntity {
  _id: Types.ObjectId;
  name: string;
  shortName: string | null;
  logo: Asset | null;
}









export interface TeamListFilter {
  status?: TeamStatus;
  name?: { $regex: string; $options: "i" };
}

export interface TeamReferenceCounts {
  players: number;
  matches: number;
  managers: number;
  seasonTeams: number;
}

export type { ITeamRepository, ITeamService, ITeamController } from "./team.interfaces.js";

export type { TeamBriefDTO, TeamDTO } from "./team.dto.js";

export type { TeamCreateDTO, TeamUpdateDTO, TeamQueryDTO } from "./team.dto.js";
