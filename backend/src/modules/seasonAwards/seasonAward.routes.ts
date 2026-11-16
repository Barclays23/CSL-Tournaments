import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { requireAdmin } from "../../middlewares/authorizeAdmin.middleware.js";
import { seasonAwardController } from "../../container/dependencies.js";

export const seasonAwardRouter = Router({ mergeParams: true });
seasonAwardRouter.get("/", seasonAwardController.list);
seasonAwardRouter.post("/", authenticate, requireAdmin, seasonAwardController.create);
seasonAwardRouter.patch("/:awardId", authenticate, requireAdmin, seasonAwardController.update);
seasonAwardRouter.delete("/:awardId", authenticate, requireAdmin, seasonAwardController.delete);
