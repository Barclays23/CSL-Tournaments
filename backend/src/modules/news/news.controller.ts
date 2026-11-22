import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../../utils/apiResponse.utils.js";
import { HTTP_STATUS } from "../../shared/constants/http-status.constants.js";
import { getRequiredRouteParam } from "../../shared/utils/routeParams.js";
import type { INewsService } from "./news.interfaces.js";
import { newsCreateSchema, newsQuerySchema, newsUpdateSchema } from "./news.schema.js";

export class NewsController {
  constructor(private readonly service: INewsService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = newsQuerySchema.parse(req.query);
      const result = await this.service.list(query, req.user?.role === "admin");
      res.status(HTTP_STATUS.OK).json(ApiResponse.success("News articles fetched", result.items, result.pagination));
    } catch (error) { next(error); }
  };

  getBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const article = await this.service.getBySlug(getRequiredRouteParam(req.params.slug, "slug"), req.user?.role === "admin");
      res.status(HTTP_STATUS.OK).json(ApiResponse.success("News article fetched", article));
    } catch (error) { next(error); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const article = await this.service.create(newsCreateSchema.parse(req.body));
      res.status(HTTP_STATUS.CREATED).json(ApiResponse.success("News article created", article));
    } catch (error) { next(error); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const article = await this.service.update(getRequiredRouteParam(req.params.id, "id"), newsUpdateSchema.parse(req.body));
      res.status(HTTP_STATUS.OK).json(ApiResponse.success("News article updated", article));
    } catch (error) { next(error); }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.delete(getRequiredRouteParam(req.params.id, "id"));
      res.status(HTTP_STATUS.OK).json(ApiResponse.success("News article deleted", null));
    } catch (error) { next(error); }
  };
}
