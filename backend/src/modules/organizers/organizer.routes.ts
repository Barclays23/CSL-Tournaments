import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { optionalAuthenticate } from "../../middlewares/optionalAuthenticate.middleware.js";
import { requireAdmin } from "../../middlewares/authorizeAdmin.middleware.js";
import { organizerController } from "../../container/dependencies.js";

export const organizerRouter = Router();
organizerRouter.get("/", optionalAuthenticate, organizerController.list);
organizerRouter.get("/:id", optionalAuthenticate, organizerController.get);
organizerRouter.post("/", authenticate, requireAdmin, organizerController.create);
organizerRouter.patch("/:id", authenticate, requireAdmin, organizerController.update);
organizerRouter.delete("/:id", authenticate, requireAdmin, organizerController.delete);
