import {Router} from "express";
import {authenticate} from "../../middlewares/authenticate.middleware.js";
import {requireAdmin} from "../../middlewares/authorizeAdmin.middleware.js";
import {groupController} from "../../container/dependencies.js";
export const groupRouter=Router({mergeParams:true});
groupRouter.get("/",groupController.list);
groupRouter.post("/",authenticate,requireAdmin,groupController.create);
groupRouter.patch("/:groupId",authenticate,requireAdmin,groupController.update);
groupRouter.delete("/:groupId",authenticate,requireAdmin,groupController.delete);
