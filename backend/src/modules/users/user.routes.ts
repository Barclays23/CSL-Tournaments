import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { requireAdmin } from "../../middlewares/authorizeAdmin.middleware.js";
import { userController } from "../../container/dependencies.js";

export const userRouter = Router();
userRouter.use(authenticate, requireAdmin);
userRouter.get("/", userController.list);
userRouter.post("/", userController.createUserByAdmin);
userRouter.patch("/:id", userController.update);
userRouter.patch("/:id/status", userController.updateStatus);
userRouter.delete("/:id", userController.delete);
