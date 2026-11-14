import type { ControllerMethod } from "../../shared/types/common.types.js";
import type { SeasonEntity, SeasonListFilter } from "./season.types.js";
import type { CreateSeasonDto, UpdateSeasonDto, SeasonQueryDto, SeasonResponseDto, RegisterSeasonTeamsDto } from "./season.dto.js";
import type { SeasonTeamEntity } from "../seasonTeams/seasonTeam.types.js";

export interface ISeasonRepository {
  findSeasons(filter: SeasonListFilter): Promise<SeasonEntity[]>;
  findById(id: string): Promise<SeasonEntity | null>;
  findByNumber(number: number): Promise<SeasonEntity | null>;
  findActive(excludeId?: string): Promise<SeasonEntity | null>;
  createWithTeams(data: CreateSeasonDto, teams: Array<{ _id: unknown; name: string; logo: SeasonTeamEntity["logoSnapshot"] }>): Promise<SeasonEntity>;
  update(id: string, data: Partial<SeasonEntity>): Promise<SeasonEntity | null>;
  countLots(seasonId: string): Promise<number>;
}

export interface ISeasonService {
  list(query: SeasonQueryDto): Promise<SeasonResponseDto[]>;
  get(id: string): Promise<SeasonResponseDto>;
  create(input: CreateSeasonDto): Promise<SeasonResponseDto>;
  update(id: string, input: UpdateSeasonDto): Promise<SeasonResponseDto>;
  registerTeams(id: string, input: RegisterSeasonTeamsDto): Promise<SeasonTeamEntity[]>;
}
export interface ISeasonController {
  list: ControllerMethod;
  get: ControllerMethod;
  create: ControllerMethod;
  update: ControllerMethod;
  registerTeams: ControllerMethod;
}
