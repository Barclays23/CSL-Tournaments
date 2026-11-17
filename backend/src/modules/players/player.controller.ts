import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../../utils/apiResponse.utils.js";
import { HTTP_STATUS } from "../../shared/constants/http-status.constants.js";
import { getRequiredRouteParam } from "../../shared/utils/routeParams.js";
import { PLAYER_MESSAGES } from "../../shared/constants/messages.constants.js";
import type { PaginatedResult } from "../../shared/types/common.types.js";
import type { IPlayerController, IPlayerService } from "./player.interfaces.js";
import type { PlayerResponseDTO, PlayerAdminDTO } from "./player.types.js";
import { playerCreateSchema, playerQuerySchema, playerUpdateSchema } from "./player.schema.js";
import type { PlayerCreateInput, PlayerQueryInput, PlayerUpdateInput } from "./player.dto.js";

export class PlayerController implements IPlayerController {
  constructor(private readonly _playerService: IPlayerService) {}
  getPlayers = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const query: PlayerQueryInput = playerQuerySchema.parse(request.query);
      const result: PaginatedResult<PlayerResponseDTO> = await this._playerService.getPlayers(query, request.user?.role === "admin");
      response.status(HTTP_STATUS.OK).json(ApiResponse.success(PLAYER_MESSAGES.PLAYERS_FETCHED, result.items, result.pagination));
    } catch (error: unknown) { next(error); }
  };
  getPlayerById = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getRequiredRouteParam(request.params.id, "id");
      const player = await this._playerService.getPlayerById(id);
      response.status(HTTP_STATUS.OK).json(ApiResponse.success(PLAYER_MESSAGES.PLAYER_FETCHED, player));
    } catch (error: unknown) { next(error); }
  };
  createPlayer = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const input: PlayerCreateInput = playerCreateSchema.parse(request.body);
      const player: PlayerAdminDTO = await this._playerService.createPlayer(input);
      response.status(HTTP_STATUS.CREATED).json(ApiResponse.success(PLAYER_MESSAGES.PLAYER_CREATED, player));
    } catch (error: unknown) { next(error); }
  };
  updatePlayer = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getRequiredRouteParam(request.params.id, "id");
      const input: PlayerUpdateInput = playerUpdateSchema.parse(request.body);
      const player: PlayerAdminDTO = await this._playerService.updatePlayer(id, input);
      response.status(HTTP_STATUS.OK).json(ApiResponse.success(PLAYER_MESSAGES.PLAYER_UPDATED, player));
    } catch (error: unknown) { next(error); }
  };
  deactivatePlayer = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getRequiredRouteParam(request.params.id, "id");
      const player = await this._playerService.deactivatePlayer(id);
      response.status(HTTP_STATUS.OK).json(ApiResponse.success(PLAYER_MESSAGES.PLAYER_DEACTIVATED, player));
    } catch (error: unknown) { next(error); }
  };
  deletePlayer = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getRequiredRouteParam(request.params.id, "id");
      await this._playerService.deletePlayer(id);
      response.status(HTTP_STATUS.OK).json(ApiResponse.success<null>(PLAYER_MESSAGES.PLAYER_DELETED, null));
    } catch (error: unknown) { next(error); }
  };
}
