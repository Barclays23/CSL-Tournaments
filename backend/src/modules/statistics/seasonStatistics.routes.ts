import {Router} from "express";
import {seasonStatisticsController} from "../../container/dependencies.js";
export const seasonStatisticsRouter=Router({mergeParams:true});
seasonStatisticsRouter.get("/standings",seasonStatisticsController.getStandings);
seasonStatisticsRouter.get("/top-scorers",seasonStatisticsController.getTopScorers);
