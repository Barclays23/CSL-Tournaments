import type { ControllerMethod } from "../../shared/types/common.types.js";
import type { SeasonEntity, SeasonListFilter, SeasonStatus } from "./season.types.js";
import type { CreateSeasonDto, UpdateSeasonDto, SeasonQueryDto, SeasonResponseDto, RegisterSeasonTeamsDto, SeasonLifecycleDto } from "./season.dto.js";
import type { SeasonTeamEntity, SeasonTeamFields } from "../seasonTeams/seasonTeam.types.js";
import type { SeasonMatchEntity } from "../matches/seasonMatch.types.js";

export interface SeasonGroupReadiness {
  groupCount: number;
  unassignedTeamCount: number;
  undersizedGroups: string[];
}

export interface ISeasonRepository {
  findSeasons(filter: SeasonListFilter): Promise<SeasonEntity[]>;
  findById(id: string): Promise<SeasonEntity | null>;
  findByNumber(number: number, excludeId?: string): Promise<SeasonEntity | null>;
  findByNormalizedName(name: string, excludeId?: string): Promise<SeasonEntity | null>;
  findActive(excludeId?: string): Promise<SeasonEntity | null>;
  createSeason(data: CreateSeasonDto, normalizedName: string): Promise<SeasonEntity>;
  update(id: string, data: Partial<SeasonEntity>): Promise<SeasonEntity | null>;
  updateStatus(id: string, current: SeasonStatus, next: SeasonStatus): Promise<SeasonEntity | null>;
  completeIfReady(id: string): Promise<{ season: SeasonEntity | null; blockers: string[] }>;
  startAuctionIfReady(id: string): Promise<{ season: SeasonEntity | null; blockers: string[] }>;
  completeAuctionIfReady(id: string): Promise<{ season: SeasonEntity | null; blockers: string[] }>;
  reopenAuction(id: string): Promise<{ season: SeasonEntity | null; fixtureCount: number }>;
  countLots(seasonId: string): Promise<number>;
  countMatches(seasonId: string): Promise<number>;
  countGroups(seasonId: string): Promise<number>;
  countSeasonTeams(seasonId: string): Promise<number>;
  countEligibleSeasonTeams(seasonId: string): Promise<number>;
  countPendingLots(seasonId: string): Promise<number>;
  getGroupReadiness(seasonId: string): Promise<SeasonGroupReadiness>;
  getMatches(seasonId: string): Promise<SeasonMatchEntity[]>;
  getMaxSoldSquadSize(seasonId: string): Promise<number>;
  registerTeamsAtomically(seasonId: string, records: SeasonTeamFields[], limit: number): Promise<SeasonTeamEntity[]>;
  deleteIfEmptyDraft(seasonId: string): Promise<boolean>;
}

export interface ISeasonService {
  list(query: SeasonQueryDto): Promise<SeasonResponseDto[]>;
  get(id: string): Promise<SeasonResponseDto>;
  create(input: CreateSeasonDto): Promise<SeasonResponseDto>;
  update(id: string, input: UpdateSeasonDto): Promise<SeasonResponseDto>;
  transition(id: string, input: SeasonLifecycleDto): Promise<SeasonResponseDto>;
  complete(id: string): Promise<SeasonResponseDto>;
  startAuction(id: string): Promise<SeasonResponseDto>;
  completeAuction(id: string): Promise<SeasonResponseDto>;
  reopenAuction(id: string): Promise<SeasonResponseDto>;
  archive(id: string): Promise<SeasonResponseDto>;
  delete(id: string): Promise<void>;
  registerTeams(id: string, input: RegisterSeasonTeamsDto): Promise<SeasonTeamEntity[]>;
}

export interface ISeasonController {
  list: ControllerMethod;
  get: ControllerMethod;
  create: ControllerMethod;
  update: ControllerMethod;
  transition: ControllerMethod;
  complete: ControllerMethod;
  startAuction: ControllerMethod;
  completeAuction: ControllerMethod;
  reopenAuction: ControllerMethod;
  archive: ControllerMethod;
  delete: ControllerMethod;
  registerTeams: ControllerMethod;
}
