import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { requireAdmin } from "../../middlewares/authorizeAdmin.middleware.js";
import { seasonMatchController } from "../../container/dependencies.js";

export const seasonMatchRouter = Router({ mergeParams: true });
seasonMatchRouter.get("/", seasonMatchController.list);
seasonMatchRouter.get("/:matchId", seasonMatchController.get);
seasonMatchRouter.post("/", authenticate, requireAdmin, seasonMatchController.create);
seasonMatchRouter.patch("/:matchId", authenticate, requireAdmin, seasonMatchController.update);
seasonMatchRouter.delete("/:matchId", authenticate, requireAdmin, seasonMatchController.delete);

// All referee operations are explicit admin-only actions.
seasonMatchRouter.post("/:matchId/start", authenticate, requireAdmin, seasonMatchController.start);
seasonMatchRouter.post("/:matchId/clock/pause", authenticate, requireAdmin, seasonMatchController.pauseClock);
seasonMatchRouter.post("/:matchId/clock/resume", authenticate, requireAdmin, seasonMatchController.resumeClock);
seasonMatchRouter.post("/:matchId/phase-transition", authenticate, requireAdmin, seasonMatchController.transitionPhase);
seasonMatchRouter.patch("/:matchId/phase/correction", authenticate, requireAdmin, seasonMatchController.correctPhase);
seasonMatchRouter.post("/:matchId/complete", authenticate, requireAdmin, seasonMatchController.complete);
seasonMatchRouter.patch("/:matchId/deciding-rules", authenticate, requireAdmin, seasonMatchController.updateDecidingRules);
seasonMatchRouter.post("/:matchId/status", authenticate, requireAdmin, seasonMatchController.changeStatus);
seasonMatchRouter.patch("/:matchId/timing/actual-kickoff", authenticate, requireAdmin, seasonMatchController.correctActualKickoff);
seasonMatchRouter.patch("/:matchId/timing/clock", authenticate, requireAdmin, seasonMatchController.correctClock);
seasonMatchRouter.patch("/:matchId/shootout", authenticate, requireAdmin, seasonMatchController.updateShootout);

seasonMatchRouter.patch("/:matchId/reschedule", authenticate, requireAdmin, seasonMatchController.reschedule);
seasonMatchRouter.post("/:matchId/corrections", authenticate, requireAdmin, seasonMatchController.correctCompleted);
seasonMatchRouter.post("/:matchId/goals", authenticate, requireAdmin, seasonMatchController.addGoal);
seasonMatchRouter.patch("/:matchId/goals/:goalId", authenticate, requireAdmin, seasonMatchController.updateGoal);
seasonMatchRouter.delete("/:matchId/goals/:goalId", authenticate, requireAdmin, seasonMatchController.deleteGoal);
seasonMatchRouter.post("/:matchId/cards", authenticate, requireAdmin, seasonMatchController.addCard);
seasonMatchRouter.patch("/:matchId/cards/:cardId", authenticate, requireAdmin, seasonMatchController.updateCard);
seasonMatchRouter.delete("/:matchId/cards/:cardId", authenticate, requireAdmin, seasonMatchController.deleteCard);
