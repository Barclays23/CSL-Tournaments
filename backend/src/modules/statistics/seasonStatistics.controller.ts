import type {Request,Response,NextFunction} from "express";
import {ApiResponse} from "../../utils/apiResponse.utils.js";
import type {ISeasonStatisticsService} from "./seasonStatistics.interfaces.js";
export class SeasonStatisticsController{
 constructor(private readonly service:ISeasonStatisticsService){}
 getStandings=async(req:Request,res:Response,next:NextFunction)=>{try{res.status(200).json(ApiResponse.success("Season standings fetched",await this.service.getStandings(req.params.seasonId!)));}catch(e){next(e);}};
 getTopScorers=async(req:Request,res:Response,next:NextFunction)=>{try{res.status(200).json(ApiResponse.success("Season top scorers fetched",await this.service.getTopScorers(req.params.seasonId!)));}catch(e){next(e);}};
 getTeamDashboard=async(req:Request,res:Response,next:NextFunction)=>{try{const seasonId=typeof req.query.seasonId==="string"?req.query.seasonId:"";res.status(200).json(ApiResponse.success("Season team dashboard fetched",await this.service.getTeamDashboard(req.params.id!,seasonId)));}catch(e){next(e);}};
 getPlayerHistory=async(req:Request,res:Response,next:NextFunction)=>{try{res.status(200).json(ApiResponse.success("Player history fetched",await this.service.getPlayerHistory(req.params.id!)));}catch(e){next(e);}};
}
