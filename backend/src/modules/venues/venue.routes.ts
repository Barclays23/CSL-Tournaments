import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { requireAdmin } from "../../middlewares/authorizeAdmin.middleware.js";
import { venueController } from "../../container/dependencies.js";
export const venueRouter = Router();
venueRouter.get("/", venueController.list);
venueRouter.post("/", authenticate, requireAdmin, venueController.create);
venueRouter.patch("/:id", authenticate, requireAdmin, venueController.update);
venueRouter.delete("/:id", authenticate, requireAdmin, venueController.delete);
