import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../../utils/apiResponse.utils.js";
import { HTTP_STATUS } from "../../shared/constants/http-status.constants.js";
import { getRequiredRouteParam } from "../../shared/utils/routeParams.js";
import type { IUserService } from "./user.interfaces.js";
import { userCreateSchema, userQuerySchema, userStatusSchema, userUpdateSchema } from "./user.schema.js";

export class UserController {
  constructor(private readonly service: IUserService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = userQuerySchema.parse(req.query);
      const result = await this.service.listUsers(query);
      res.status(HTTP_STATUS.OK).json(ApiResponse.success("Users fetched", result.items, result.pagination));
    } catch (error) { next(error); }
  };

  createUserByAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = userCreateSchema.parse(req.body);
      const user = await this.service.createUserByAdmin(input);
      res.status(HTTP_STATUS.CREATED).json(ApiResponse.success("User created", user));
    } catch (error) { next(error); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = userUpdateSchema.parse(req.body);
      const user = await this.service.updateUser(getRequiredRouteParam(req.params.id, "id"), input, req.user?.id ?? "");
      res.status(HTTP_STATUS.OK).json(ApiResponse.success("User updated", user));
    } catch (error) { next(error); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = userStatusSchema.parse(req.body);
      const user = await this.service.updateUserStatus(getRequiredRouteParam(req.params.id, "id"), input.status, req.user?.id ?? "");
      res.status(HTTP_STATUS.OK).json(ApiResponse.success("User status updated", user));
    } catch (error) { next(error); }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.deleteUser(getRequiredRouteParam(req.params.id, "id"), req.user?.id ?? "");
      res.status(HTTP_STATUS.OK).json(ApiResponse.success("User deleted", null));
    } catch (error) { next(error); }
  };
}
