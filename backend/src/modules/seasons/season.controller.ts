import type {Request,Response,NextFunction} from "express";
import {ApiResponse} from "../../utils/apiResponse.utils.js";
import {HTTP_STATUS} from "../../shared/constants/http-status.constants.js";
import type {ISeasonService} from "./season.interfaces.js";
import type {CreateSeasonDto,UpdateSeasonDto,SeasonQueryDto,RegisterSeasonTeamsDto} from "./season.dto.js";
import {seasonCreateSchema,seasonUpdateSchema,seasonQuerySchema,registerSeasonTeamsSchema} from "./season.schema.js";
export class SeasonController{
 constructor(private readonly service:ISeasonService){}
 list=async(req:Request,res:Response,next:NextFunction)=>{try{const q=seasonQuerySchema.parse(req.query) as SeasonQueryDto;res.status(HTTP_STATUS.OK).json(ApiResponse.success("Seasons fetched",await this.service.list(q)));}catch(e){next(e);}};
 get=async(req:Request,res:Response,next:NextFunction)=>{try{res.status(HTTP_STATUS.OK).json(ApiResponse.success("Season fetched",await this.service.get(req.params.id!)));}catch(e){next(e);}};
 create=async(req:Request,res:Response,next:NextFunction)=>{try{const input=seasonCreateSchema.parse(req.body) as CreateSeasonDto;res.status(HTTP_STATUS.CREATED).json(ApiResponse.success("Season created",await this.service.create(input)));}catch(e){next(e);}};
 update=async(req:Request,res:Response,next:NextFunction)=>{try{const input=seasonUpdateSchema.parse(req.body) as UpdateSeasonDto;res.status(HTTP_STATUS.OK).json(ApiResponse.success("Season updated",await this.service.update(req.params.id!,input)));}catch(e){next(e);}};
 registerTeams=async(req:Request,res:Response,next:NextFunction)=>{try{const input=registerSeasonTeamsSchema.parse(req.body) as RegisterSeasonTeamsDto;res.status(HTTP_STATUS.CREATED).json(ApiResponse.success("Season teams registered",await this.service.registerTeams(req.params.id!,input)));}catch(e){next(e);}};
}
