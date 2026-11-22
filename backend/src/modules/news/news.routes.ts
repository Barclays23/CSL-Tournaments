import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { optionalAuthenticate } from "../../middlewares/optionalAuthenticate.middleware.js";
import { requireAdmin } from "../../middlewares/authorizeAdmin.middleware.js";
import { newsController } from "../../container/dependencies.js";

export const newsRouter = Router();

newsRouter.get("/", optionalAuthenticate, newsController.list);
newsRouter.get("/slug/:slug", optionalAuthenticate, newsController.getBySlug);
newsRouter.post("/", authenticate, requireAdmin, newsController.create);
newsRouter.patch("/:id", authenticate, requireAdmin, newsController.update);
newsRouter.delete("/:id", authenticate, requireAdmin, newsController.delete);
