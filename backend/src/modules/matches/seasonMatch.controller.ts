import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../../utils/apiResponse.utils.js";
import { getRequiredRouteParam } from "../../shared/utils/routeParams.js";
import {
  seasonGoalSchema, seasonMatchCreateSchema, seasonMatchQuerySchema, seasonMatchUpdateSchema,
  seasonMatchRescheduleSchema, seasonMatchCorrectionSchema, seasonMatchCardSchema,
  decidingRulesUpdateSchema, matchStatusActionSchema, actualKickoffCorrectionSchema,
  matchClockCorrectionSchema, matchShootoutUpdateSchema, matchPhaseTransitionSchema,
  matchPhaseCorrectionSchema,
  matchEventDeleteSchema,
} from "./seasonMatch.schema.js";
import type { ISeasonMatchService } from "./seasonMatch.interfaces.js";

export class SeasonMatchController {
  constructor(private readonly service: ISeasonMatchService) {}
  private matchId(req: Request): string { return getRequiredRouteParam(req.params.matchId, "matchId"); }
  private actor(req: Request): string { return req.user?.id ?? ""; }

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = seasonMatchQuerySchema.parse(req.query);
      res.status(200).json(ApiResponse.success("Season matches fetched", await this.service.list(getRequiredRouteParam(req.params.seasonId, "seasonId"), query)));
    } catch (error) { next(error); }
  };
  get = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(200).json(ApiResponse.success("Season match fetched", await this.service.get(this.matchId(req)))); }
    catch (error) { next(error); }
  };
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = seasonMatchCreateSchema.parse(req.body);
      res.status(201).json(ApiResponse.success("Season match created", await this.service.create(getRequiredRouteParam(req.params.seasonId, "seasonId"), input)));
    } catch (error) { next(error); }
  };
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = seasonMatchUpdateSchema.parse(req.body);
      res.status(200).json(ApiResponse.success("Season match updated", await this.service.update(this.matchId(req), input, this.actor(req))));
    } catch (error) { next(error); }
  };
  start = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(200).json(ApiResponse.success("Match started", await this.service.startMatch(this.matchId(req), this.actor(req)))); }
    catch (error) { next(error); }
  };
  pauseClock = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(200).json(ApiResponse.success("Match clock paused", await this.service.pauseClock(this.matchId(req), this.actor(req)))); }
    catch (error) { next(error); }
  };
  resumeClock = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(200).json(ApiResponse.success("Match clock resumed", await this.service.resumeClock(this.matchId(req), this.actor(req)))); }
    catch (error) { next(error); }
  };
  transitionPhase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { action } = matchPhaseTransitionSchema.parse(req.body);
      res.status(200).json(ApiResponse.success("Match phase updated", await this.service.transitionPhase(this.matchId(req), action, this.actor(req))));
    } catch (error) { next(error); }
  };
  correctPhase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = matchPhaseCorrectionSchema.parse(req.body);
      res.status(200).json(ApiResponse.success("Match phase corrected", await this.service.correctPhase(this.matchId(req), input, this.actor(req))));
    } catch (error) { next(error); }
  };
  complete = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(200).json(ApiResponse.success("Match completed", await this.service.completeMatch(this.matchId(req), this.actor(req)))); }
    catch (error) { next(error); }
  };
  updateDecidingRules = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = decidingRulesUpdateSchema.parse(req.body);
      res.status(200).json(ApiResponse.success("Match deciding rules updated", await this.service.updateDecidingRules(this.matchId(req), input, this.actor(req))));
    } catch (error) { next(error); }
  };
  changeStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = matchStatusActionSchema.parse(req.body);
      res.status(200).json(ApiResponse.success("Match status updated", await this.service.changeStatus(this.matchId(req), input, this.actor(req))));
    } catch (error) { next(error); }
  };
  correctActualKickoff = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = actualKickoffCorrectionSchema.parse(req.body);
      res.status(200).json(ApiResponse.success("Actual kickoff corrected", await this.service.correctActualKickoff(this.matchId(req), input, this.actor(req))));
    } catch (error) { next(error); }
  };
  correctClock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = matchClockCorrectionSchema.parse(req.body);
      res.status(200).json(ApiResponse.success("Match clock corrected", await this.service.correctClock(this.matchId(req), input, this.actor(req))));
    } catch (error) { next(error); }
  };
  updateShootout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = matchShootoutUpdateSchema.parse(req.body);
      res.status(200).json(ApiResponse.success("Penalty shootout updated", await this.service.updateShootout(this.matchId(req), input, this.actor(req))));
    } catch (error) { next(error); }
  };
  reschedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = seasonMatchRescheduleSchema.parse(req.body);
      res.status(200).json(ApiResponse.success("Match rescheduled", await this.service.reschedule(this.matchId(req), input, this.actor(req))));
    } catch (error) { next(error); }
  };
  correctCompleted = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = seasonMatchCorrectionSchema.parse(req.body);
      res.status(200).json(ApiResponse.success("Completed match corrected", await this.service.correctCompletedMatch(this.matchId(req), input, this.actor(req))));
    } catch (error) { next(error); }
  };
  delete = async (req: Request, res: Response, next: NextFunction) => {
    try { await this.service.delete(this.matchId(req)); res.status(200).json(ApiResponse.success("Season match deleted", null)); }
    catch (error) { next(error); }
  };
  addGoal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = seasonGoalSchema.parse(req.body);
      res.status(201).json(ApiResponse.success("Goal added", await this.service.addGoal(this.matchId(req), input, this.actor(req))));
    } catch (error) { next(error); }
  };
  updateGoal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = seasonGoalSchema.parse(req.body);
      res.status(200).json(ApiResponse.success("Goal updated", await this.service.updateGoal(this.matchId(req), getRequiredRouteParam(req.params.goalId, "goalId"), input, this.actor(req))));
    } catch (error) { next(error); }
  };
  deleteGoal = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(200).json(ApiResponse.success("Goal deleted", await this.service.deleteGoal(this.matchId(req), getRequiredRouteParam(req.params.goalId, "goalId"), this.actor(req), matchEventDeleteSchema.parse(req.body ?? {}).reason))); }
    catch (error) { next(error); }
  };
  addCard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = seasonMatchCardSchema.parse(req.body);
      res.status(201).json(ApiResponse.success("Card recorded", await this.service.addCard(this.matchId(req), input, this.actor(req))));
    } catch (error) { next(error); }
  };
  updateCard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = seasonMatchCardSchema.parse(req.body);
      res.status(200).json(ApiResponse.success("Card updated", await this.service.updateCard(this.matchId(req), getRequiredRouteParam(req.params.cardId, "cardId"), input, this.actor(req))));
    } catch (error) { next(error); }
  };
  deleteCard = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(200).json(ApiResponse.success("Card deleted", await this.service.deleteCard(this.matchId(req), getRequiredRouteParam(req.params.cardId, "cardId"), this.actor(req), matchEventDeleteSchema.parse(req.body ?? {}).reason))); }
    catch (error) { next(error); }
  };
}
