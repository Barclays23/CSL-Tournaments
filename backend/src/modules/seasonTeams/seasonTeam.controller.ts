import type {Request,Response,NextFunction} from "express";
import {ApiResponse} from "../../utils/apiResponse.utils.js";
import {updateSeasonTeamSchema} from "./seasonTeam.schema.js";
import type {ISeasonTeamService} from "./seasonTeam.interfaces.js";
import type {UpdateSeasonTeamDto} from "./seasonTeam.dto.js";
export class SeasonTeamController{
 constructor(private readonly service:ISeasonTeamService){}
 list=async(req:Request,res:Response,next:NextFunction)=>{try{res.status(200).json(ApiResponse.success("Season teams fetched",await this.service.list(req.params.seasonId!)));}catch(e){next(e);}};
 update=async(req:Request,res:Response,next:NextFunction)=>{try{const input=updateSeasonTeamSchema.parse(req.body) as UpdateSeasonTeamDto;res.status(200).json(ApiResponse.success("Season team updated",await this.service.update(req.params.id!,input)));}catch(e){next(e);}};
}
