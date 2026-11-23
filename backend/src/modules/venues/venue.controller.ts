import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../../utils/apiResponse.utils.js";
import { getRequiredRouteParam } from "../../shared/utils/routeParams.js";
import { venueCreateSchema, venueQuerySchema, venueUpdateSchema } from "./venue.schema.js";
import { VenueService } from "./venue.service.js";
import type { VenueUpdateDto } from "./venue.types.js";
export class VenueController {
  constructor(private readonly service: VenueService) {}
  list = async (req: Request, res: Response, next: NextFunction) => { try { const query = venueQuerySchema.parse(req.query); res.status(200).json(ApiResponse.success("Venues fetched", await this.service.list(query.status ?? "active", req.user?.role === "admin"))); } catch (e) { next(e); } };
  get = async (req: Request, res: Response, next: NextFunction) => { try { res.status(200).json(ApiResponse.success("Venue fetched", await this.service.get(getRequiredRouteParam(req.params.id, "id"), req.user?.role === "admin"))); } catch (e) { next(e); } };
  create = async (req: Request, res: Response, next: NextFunction) => { try { const input = venueCreateSchema.parse(req.body); res.status(201).json(ApiResponse.success("Venue created", await this.service.create(input))); } catch (e) { next(e); } };
  update = async (req: Request, res: Response, next: NextFunction) => { try { const input = venueUpdateSchema.parse(req.body); res.status(200).json(ApiResponse.success("Venue updated", await this.service.update(getRequiredRouteParam(req.params.id, "id"), input as VenueUpdateDto))); } catch (e) { next(e); } };
  delete = async (req: Request, res: Response, next: NextFunction) => { try { await this.service.delete(getRequiredRouteParam(req.params.id, "id")); res.status(200).json(ApiResponse.success("Venue deleted", null)); } catch (e) { next(e); } };
}
