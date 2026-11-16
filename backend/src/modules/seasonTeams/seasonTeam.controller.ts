import type {Request,Response,NextFunction} from "express";
import {ApiResponse} from "../../utils/apiResponse.utils.js";
import {getRequiredRouteParam} from "../../shared/utils/routeParams.js";
import {updateSeasonTeamSchema} from "./seasonTeam.schema.js";
import type {ISeasonTeamService} from "./seasonTeam.interfaces.js";
import type {UpdateSeasonTeamDto} from "./seasonTeam.dto.js";
export class SeasonTeamController{
 constructor(private readonly service:ISeasonTeamService){}
 list=async(req:Request,res:Response,next:NextFunction)=>{try{res.status(200).json(ApiResponse.success("Season teams fetched",await this.service.list(getRequiredRouteParam(req.params.seasonId, "seasonId"))));}catch(e){next(e);}};
 remove=async(req:Request,res:Response,next:NextFunction)=>{try{await this.service.remove(getRequiredRouteParam(req.params.seasonId, "seasonId"),getRequiredRouteParam(req.params.id, "id"));res.status(200).json(ApiResponse.success("Unused season team removed",null));}catch(e){next(e);}};
 withdraw=async(req:Request,res:Response,next:NextFunction)=>{try{res.status(200).json(ApiResponse.success("Season team withdrawn",await this.service.withdraw(getRequiredRouteParam(req.params.seasonId, "seasonId"),getRequiredRouteParam(req.params.id, "id"))));}catch(e){next(e);}};
 update=async(req:Request,res:Response,next:NextFunction)=>{try{const input=updateSeasonTeamSchema.parse(req.body) as UpdateSeasonTeamDto;res.status(200).json(ApiResponse.success("Season team updated",await this.service.update(getRequiredRouteParam(req.params.seasonId, "seasonId"),getRequiredRouteParam(req.params.id, "id"),input)));}catch(e){next(e);}};
}
