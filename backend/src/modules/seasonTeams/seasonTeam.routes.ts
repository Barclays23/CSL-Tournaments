import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { requireAdmin } from "../../middlewares/authorizeAdmin.middleware.js";
import { seasonTeamController } from "../../container/dependencies.js";
export const seasonTeamRouter = Router({ mergeParams: true });
seasonTeamRouter.get("/", seasonTeamController.list);
seasonTeamRouter.patch("/:id", authenticate, requireAdmin, seasonTeamController.update);

seasonTeamRouter.delete("/:id", authenticate, requireAdmin, seasonTeamController.remove);
seasonTeamRouter.post("/:id/withdraw", authenticate, requireAdmin, seasonTeamController.withdraw);

seasonTeamRouter.post("/:id/recall", authenticate, requireAdmin, seasonTeamController.recall);
