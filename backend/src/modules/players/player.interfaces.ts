import type { ControllerMethod, PaginatedResult } from "../../shared/types/common.types.js";
import type { PlayerFields, PlayerEntity, PlayerAdminDTO, PlayerResponseDTO, PlayerCreateDTO, PlayerUpdateDTO, PlayerQueryDTO, PlayerListFilter } from "./player.types.js";

export interface IPlayerRepository {
  findPlayers(filter: PlayerListFilter, page: number, limit: number): Promise<{ items: PlayerEntity[]; total: number }>;
  findPlayerById(playerId: string): Promise<PlayerEntity | null>;
  findPlayerByMobile(mobile: string): Promise<PlayerEntity | null>;
  findPlayerByEmail(email: string): Promise<PlayerEntity | null>;
  countPlayerReferences(playerId: string): Promise<{ auctionLots: number; seasonMatches: number; legacyMatches: number; awards: number }>;
 
  createPlayer(data: PlayerFields): Promise<PlayerEntity>;
  updatePlayer(playerId: string, data: Partial<PlayerFields>): Promise<PlayerEntity | null>;
  deletePlayerIfUnreferenced(playerId: string): Promise<boolean>;
}
export interface IPlayerService {
  getPlayers(query: PlayerQueryDTO, isAdmin: boolean): Promise<PaginatedResult<PlayerResponseDTO>>;
  getPlayerById(playerId: string, isAdmin: boolean): Promise<PlayerResponseDTO>;
  createPlayer(input: PlayerCreateDTO): Promise<PlayerAdminDTO>;
  updatePlayer(playerId: string, input: PlayerUpdateDTO): Promise<PlayerAdminDTO>;
  deactivatePlayer(playerId: string): Promise<PlayerAdminDTO>;
  deletePlayer(playerId: string): Promise<void>;
}
export interface IPlayerController {
  getPlayers: ControllerMethod;
  getPlayerById: ControllerMethod;
  getPlayerAdminDetails: ControllerMethod;
  createPlayer: ControllerMethod;
  updatePlayer: ControllerMethod;
  deactivatePlayer: ControllerMethod;
  deletePlayer: ControllerMethod;
}
