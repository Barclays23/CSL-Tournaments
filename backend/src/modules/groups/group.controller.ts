import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../../utils/apiResponse.utils.js";
import { getRequiredRouteParam } from "../../shared/utils/routeParams.js";
import type { IGroupService } from "./group.interfaces.js";
import type { CreateGroupDto, UpdateGroupDto } from "./group.dto.js";
import { groupCreateSchema, groupUpdateSchema } from "./group.schema.js";

export class GroupController {
  constructor(private readonly _groupService: IGroupService) {}

  list = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const seasonId = getRequiredRouteParam(request.params.seasonId, "seasonId");
      const groups = await this._groupService.list(seasonId);
      response.status(200).json(ApiResponse.success("Groups fetched", groups));
    } catch (error) {
      next(error);
    }
  };

  create = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const seasonId = getRequiredRouteParam(request.params.seasonId, "seasonId");
      const input = groupCreateSchema.parse(request.body) as CreateGroupDto;
      const group = await this._groupService.create(seasonId, input);
      response.status(201).json(ApiResponse.success("Group created", group));
    } catch (error) {
      next(error);
    }
  };

  update = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const seasonId = getRequiredRouteParam(request.params.seasonId, "seasonId");
      const groupId = getRequiredRouteParam(request.params.groupId, "groupId");
      const input = groupUpdateSchema.parse(request.body) as UpdateGroupDto;
      const group = await this._groupService.update(seasonId, groupId, input);
      response.status(200).json(ApiResponse.success("Group updated", group));
    } catch (error) {
      next(error);
    }
  };

  delete = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const seasonId = getRequiredRouteParam(request.params.seasonId, "seasonId");
      const groupId = getRequiredRouteParam(request.params.groupId, "groupId");
      await this._groupService.delete(seasonId, groupId);
      response.status(200).json(ApiResponse.success("Unused group deleted", null));
    } catch (error) {
      next(error);
    }
  };
}
