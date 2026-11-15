import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../../utils/apiResponse.utils.js";
import { HTTP_STATUS } from "../../shared/constants/http-status.constants.js";
import type { ISeasonService } from "./season.interfaces.js";
import type { CreateSeasonDto, UpdateSeasonDto, SeasonQueryDto, RegisterSeasonTeamsDto, SeasonLifecycleDto } from "./season.dto.js";
import { seasonCreateSchema, seasonUpdateSchema, seasonQuerySchema, registerSeasonTeamsSchema, seasonLifecycleSchema } from "./season.schema.js";

export class SeasonController {
  constructor(private readonly service: ISeasonService) {}

  list = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const query = seasonQuerySchema.parse(request.query) as SeasonQueryDto;
      response.status(HTTP_STATUS.OK).json(ApiResponse.success("Seasons fetched", await this.service.list(query)));
    } catch (error) { next(error); }
  };

  get = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      response.status(HTTP_STATUS.OK).json(ApiResponse.success("Season fetched", await this.service.get(request.params.id!)));
    } catch (error) { next(error); }
  };

  create = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const input = seasonCreateSchema.parse(request.body) as CreateSeasonDto;
      response.status(HTTP_STATUS.CREATED).json(ApiResponse.success("Draft season created", await this.service.create(input)));
    } catch (error) { next(error); }
  };

  update = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const input = seasonUpdateSchema.parse(request.body) as UpdateSeasonDto;
      response.status(HTTP_STATUS.OK).json(ApiResponse.success("Season updated", await this.service.update(request.params.id!, input)));
    } catch (error) { next(error); }
  };

  transition = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const input = seasonLifecycleSchema.parse(request.body) as SeasonLifecycleDto;
      response.status(HTTP_STATUS.OK).json(ApiResponse.success("Season status updated", await this.service.transition(request.params.id!, input)));
    } catch (error) { next(error); }
  };

  complete = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      response.status(HTTP_STATUS.OK).json(ApiResponse.success("Season completed", await this.service.complete(request.params.id!)));
    } catch (error) { next(error); }
  };

  archive = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      response.status(HTTP_STATUS.OK).json(ApiResponse.success("Season archived", await this.service.archive(request.params.id!)));
    } catch (error) { next(error); }
  };

  delete = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.delete(request.params.id!);
      response.status(HTTP_STATUS.OK).json(ApiResponse.success("Empty Draft season deleted", null));
    } catch (error) { next(error); }
  };

  registerTeams = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const input = registerSeasonTeamsSchema.parse(request.body) as RegisterSeasonTeamsDto;
      response.status(HTTP_STATUS.CREATED).json(ApiResponse.success("Season teams registered", await this.service.registerTeams(request.params.id!, input)));
    } catch (error) { next(error); }
  };
}
