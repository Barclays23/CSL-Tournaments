import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../../utils/apiResponse.utils.js";
import { HTTP_STATUS } from "../../shared/constants/http-status.constants.js";
import { getRequiredRouteParam } from "../../shared/utils/routeParams.js";
import type { IOrganizerService } from "./organizer.interfaces.js";
import { organizerCreateSchema, organizerQuerySchema, organizerUpdateSchema } from "./organizer.schema.js";

export class OrganizerController {
  constructor(private readonly service: IOrganizerService) {}
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = organizerQuerySchema.parse(req.query);
      const result = await this.service.getOrganizers(query, req.user?.role === "admin");
      res.status(HTTP_STATUS.OK).json(ApiResponse.success("Organizers fetched", result.items, result.pagination));
    } catch (error) { next(error); }
  };
  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getOrganizerById(getRequiredRouteParam(req.params.id, "id"), req.user?.role === "admin");
      res.status(HTTP_STATUS.OK).json(ApiResponse.success("Organizer fetched", result));
    } catch (error) { next(error); }
  };
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createOrganizer(organizerCreateSchema.parse(req.body));
      res.status(HTTP_STATUS.CREATED).json(ApiResponse.success("Organizer created", result));
    } catch (error) { next(error); }
  };
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.updateOrganizer(getRequiredRouteParam(req.params.id, "id"), organizerUpdateSchema.parse(req.body));
      res.status(HTTP_STATUS.OK).json(ApiResponse.success("Organizer updated", result));
    } catch (error) { next(error); }
  };
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.deleteOrganizer(getRequiredRouteParam(req.params.id, "id"));
      res.status(HTTP_STATUS.OK).json(ApiResponse.success("Organizer deleted", null));
    } catch (error) { next(error); }
  };
}
