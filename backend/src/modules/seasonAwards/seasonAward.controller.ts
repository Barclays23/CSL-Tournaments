import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../../utils/apiResponse.utils.js";
import { getRequiredRouteParam } from "../../shared/utils/routeParams.js";
import { seasonAwardCreateSchema, seasonAwardUpdateSchema } from "./seasonAward.schema.js";
import type { ISeasonAwardService } from "./seasonAward.dto.js";

export class SeasonAwardController {
  constructor(private readonly service: ISeasonAwardService) {}

  list = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const seasonId = getRequiredRouteParam(request.params.seasonId, "seasonId");
      response.status(200).json(ApiResponse.success("Season achievements fetched", await this.service.list(seasonId)));
    } catch (error) { next(error); }
  };

  create = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const seasonId = getRequiredRouteParam(request.params.seasonId, "seasonId");
      const input = seasonAwardCreateSchema.parse(request.body);
      response.status(201).json(ApiResponse.success("Season award assigned", await this.service.create(seasonId, input)));
    } catch (error) { next(error); }
  };

  update = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const seasonId = getRequiredRouteParam(request.params.seasonId, "seasonId");
      const awardId = getRequiredRouteParam(request.params.awardId, "awardId");
      const input = seasonAwardUpdateSchema.parse(request.body);
      response.status(200).json(ApiResponse.success("Season award updated", await this.service.update(seasonId, awardId, input)));
    } catch (error) { next(error); }
  };

  delete = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const seasonId = getRequiredRouteParam(request.params.seasonId, "seasonId");
      const awardId = getRequiredRouteParam(request.params.awardId, "awardId");
      await this.service.delete(seasonId, awardId);
      response.status(200).json(ApiResponse.success("Optional season award removed", null));
    } catch (error) { next(error); }
  };
}
