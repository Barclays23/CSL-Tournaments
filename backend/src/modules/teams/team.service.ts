import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import type { PaginatedResult } from "../../shared/types/common.types.js";
import type { ITeamService, ITeamRepository } from "./team.interfaces.js";
import type { TeamCreateDTO, TeamDTO, TeamFields, TeamListFilter, TeamQueryDTO, TeamUpdateDTO } from "./team.types.js";

export class TeamService implements ITeamService {
  constructor(private readonly _teamRepository: ITeamRepository) {}

  async getTeams(query: TeamQueryDTO, isAdmin: boolean): Promise<PaginatedResult<TeamDTO>> {
    const filter: TeamListFilter = {};
    if (isAdmin && query.status) filter.status = query.status;
    else if (!isAdmin) filter.status = "active";
    if (query.search) {
      const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.name = { $regex: escapedSearch, $options: "i" };
    }

    const result = await this._teamRepository.findTeams(filter, query.page, query.limit);
    return {
      items: result.items.map((team) => this.mapTeamToDTO(team)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  async getTeamById(teamId: string): Promise<TeamDTO> {
    this.ensureValidTeamId(teamId);
    const team = await this._teamRepository.findTeamById(teamId);
    if (!team || team.status !== "active") throw new AppError("Team not found", 404, "TEAM_NOT_FOUND");
    return this.mapTeamToDTO(team);
  }

  async createTeam(input: TeamCreateDTO): Promise<TeamDTO> {
    const existingTeam = await this._teamRepository.findTeamByName(input.name);
    if (existingTeam) {
      throw new AppError("Team name already exists", 409, "DUPLICATE_TEAM", { name: "Team name already exists" });
    }

    try {
      const createdTeam = await this._teamRepository.createTeam(input);
      return this.mapTeamToDTO(createdTeam);
    } catch (error: unknown) {
      this.handleDuplicateNameError(error);
    }
  }

  async updateTeam(teamId: string, input: TeamUpdateDTO): Promise<TeamDTO> {
    this.ensureValidTeamId(teamId);
    const existingTeam = await this._teamRepository.findTeamById(teamId);
    if (!existingTeam) throw new AppError("Team not found", 404, "TEAM_NOT_FOUND");

    if (input.name && input.name.trim().toLowerCase() !== existingTeam.name.toLowerCase()) {
      const duplicateTeam = await this._teamRepository.findTeamByName(input.name);
      if (duplicateTeam && String(duplicateTeam._id) !== teamId) {
        throw new AppError("Team name already exists", 409, "DUPLICATE_TEAM", { name: "Team name already exists" });
      }
    }

    if (input.status === "inactive") {
      const references = await this._teamRepository.findTeamReferenceCounts(teamId);
      if (references.players > 0 || references.managers > 0 || references.matches > 0 || references.seasonTeams > 0) {
        throw new AppError("This Team is referenced by players, managers, fixtures or SeasonTeam history", 409, "TEAM_REFERENCED");
      }
    }

    try {
      const updatedTeam = await this._teamRepository.updateTeam(teamId, input);
      if (!updatedTeam) throw new AppError("Team not found", 404, "TEAM_NOT_FOUND");
      return this.mapTeamToDTO(updatedTeam);
    } catch (error: unknown) {
      this.handleDuplicateNameError(error);
    }
  }

  async deleteTeam(teamId: string): Promise<void> {
    this.ensureValidTeamId(teamId);
    const references = await this._teamRepository.findTeamReferenceCounts(teamId);
    if (references.players > 0 || references.managers > 0 || references.matches > 0 || references.seasonTeams > 0) {
      throw new AppError("This permanent Team is referenced by player, manager, fixture or SeasonTeam history and cannot be deleted", 409, "TEAM_REFERENCED");
    }
    const deleted = await this._teamRepository.deleteTeam(teamId);
    if (!deleted) throw new AppError("Team not found", 404, "TEAM_NOT_FOUND");
  }

  private handleDuplicateNameError(error: unknown): never {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000) {
      throw new AppError("Team name already exists", 409, "DUPLICATE_TEAM", { name: "Team name already exists" });
    }
    throw error;
  }

  private mapTeamToDTO(team: TeamFields & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date }): TeamDTO {
    return {
      _id: String(team._id),
      name: team.name,
      shortName: team.shortName,
      description: team.description ?? null,
      logo: team.logo,
      poster: team.poster,
      status: team.status,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
    };
  }

  private ensureValidTeamId(teamId: string): void {
    if (!Types.ObjectId.isValid(teamId)) throw new AppError("Invalid team ID", 400, "INVALID_ID");
  }
}
