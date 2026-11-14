import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../../utils/apiResponse.utils.js";
import { seasonGoalSchema, seasonMatchCreateSchema, seasonMatchQuerySchema, seasonMatchUpdateSchema } from "./seasonMatch.schema.js";
import type { ISeasonMatchService } from "./seasonMatch.interfaces.js";
export class SeasonMatchController {
 constructor(private readonly service: ISeasonMatchService) {}
 list = async (req: Request, res: Response, next: NextFunction) => { try { const query = seasonMatchQuerySchema.parse(req.query); res.status(200).json(ApiResponse.success("Season matches fetched", await this.service.list(req.params.seasonId!, query))); } catch (e) { next(e); } };
 get = async (req: Request, res: Response, next: NextFunction) => { try { res.status(200).json(ApiResponse.success("Season match fetched", await this.service.get(req.params.matchId!))); } catch (e) { next(e); } };
 create = async (req: Request, res: Response, next: NextFunction) => { try { const input = seasonMatchCreateSchema.parse(req.body); res.status(201).json(ApiResponse.success("Season match created", await this.service.create(req.params.seasonId!, input))); } catch (e) { next(e); } };
 update = async (req: Request, res: Response, next: NextFunction) => { try { const input = seasonMatchUpdateSchema.parse(req.body); res.status(200).json(ApiResponse.success("Season match updated", await this.service.update(req.params.matchId!, input))); } catch (e) { next(e); } };
 delete = async (req: Request, res: Response, next: NextFunction) => { try { await this.service.delete(req.params.matchId!); res.status(200).json(ApiResponse.success("Season match deleted", null)); } catch (e) { next(e); } };
 addGoal = async (req: Request, res: Response, next: NextFunction) => { try { const input = seasonGoalSchema.parse(req.body); res.status(201).json(ApiResponse.success("Goal added", await this.service.addGoal(req.params.matchId!, input))); } catch (e) { next(e); } };
 updateGoal = async (req: Request, res: Response, next: NextFunction) => { try { const input = seasonGoalSchema.parse(req.body); res.status(200).json(ApiResponse.success("Goal updated", await this.service.updateGoal(req.params.matchId!, req.params.goalId!, input))); } catch (e) { next(e); } };
 deleteGoal = async (req: Request, res: Response, next: NextFunction) => { try { res.status(200).json(ApiResponse.success("Goal deleted", await this.service.deleteGoal(req.params.matchId!, req.params.goalId!))); } catch (e) { next(e); } };
}
