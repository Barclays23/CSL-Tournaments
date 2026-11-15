import {Router} from "express";
import {authenticate} from "../../middlewares/authenticate.middleware.js";
import {requireAdmin} from "../../middlewares/authorizeAdmin.middleware.js";
import {seasonController} from "../../container/dependencies.js";
import {seasonTeamRouter} from "../seasonTeams/seasonTeam.routes.js";
import {groupRouter} from "../groups/group.routes.js";
import {seasonMatchRouter} from "../matches/seasonMatch.routes.js";
import {seasonStatisticsRouter} from "../statistics/seasonStatistics.routes.js";




export const seasonRouter = Router();



seasonRouter.use("/:seasonId/teams",seasonTeamRouter);
seasonRouter.use("/:seasonId/groups",groupRouter);
seasonRouter.use("/:seasonId/matches",seasonMatchRouter);
seasonRouter.use("/:seasonId",seasonStatisticsRouter);


seasonRouter.get("/",seasonController.list);
seasonRouter.get("/:id",seasonController.get);
seasonRouter.post("/",authenticate,requireAdmin,seasonController.create);
seasonRouter.patch("/:id",authenticate,requireAdmin,seasonController.update);
seasonRouter.post("/:id/teams",authenticate,requireAdmin,seasonController.registerTeams);
