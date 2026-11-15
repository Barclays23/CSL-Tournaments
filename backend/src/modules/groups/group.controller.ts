import type {Request,Response,NextFunction} from "express";
import {Types} from "mongoose";
import {ApiResponse} from "../../utils/apiResponse.utils.js";
import {AppError} from "../../shared/errors/appError.js";
import {groupCreateSchema,groupUpdateSchema} from "./group.schema.js";
import type {GroupRepository} from "./group.repository.js";
import {GroupModel} from "./group.model.js";
import {SeasonModel} from "../seasons/season.model.js";
import {SeasonTeamModel} from "../seasonTeams/seasonTeam.model.js";
import {SeasonMatchModel} from "../matches/seasonMatch.model.js";
import {getRequiredRouteParam} from "../../shared/utils/routeParams.js";
import {normalizeGroupName} from "./group.repository.js";

export class GroupController{
 constructor(private readonly repo:GroupRepository){}
 list=async(req:Request,res:Response,next:NextFunction):Promise<void>=>{
  try{
   const id=getRequiredRouteParam(req.params.seasonId,"seasonId");
   if(!Types.ObjectId.isValid(id))throw new AppError("Invalid season ID",400,"INVALID_ID");
   const season=await SeasonModel.findById(id).select("_id").lean().exec();
   if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
   const groups=await this.repo.findBySeason(id);
   res.status(200).json(ApiResponse.success("Groups fetched",groups.map(g=>({...g,_id:String(g._id),seasonRef:String(g.seasonRef),createdAt:g.createdAt.toISOString(),updatedAt:g.updatedAt.toISOString()}))));
  }catch(error){next(error);}
 };
 create=async(req:Request,res:Response,next:NextFunction):Promise<void>=>{
  try{
   const id=getRequiredRouteParam(req.params.seasonId,"seasonId");
   if(!Types.ObjectId.isValid(id))throw new AppError("Invalid season ID",400,"INVALID_ID");
   const season=await SeasonModel.findById(id).select("status").lean().exec();
   if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
   if(!["draft","upcoming"].includes(season.status))throw new AppError("Groups can only be created before activation",409,"GROUP_CREATION_FROZEN");
   if(await SeasonMatchModel.countDocuments({seasonRef:id}).exec())throw new AppError("Groups cannot be added after the first fixture is created",409,"GROUPS_LOCKED");
   const input=groupCreateSchema.parse(req.body);
   if(await this.repo.findByName(id,input.groupName))throw new AppError("A group with this name already exists in this season",409,"DUPLICATE_GROUP");
   const created=await this.repo.create({seasonRef:new Types.ObjectId(id),groupName:input.groupName,normalizedGroupName:normalizeGroupName(input.groupName),displayOrder:input.displayOrder});
   res.status(201).json(ApiResponse.success("Group created",{...created,_id:String(created._id),seasonRef:String(created.seasonRef),createdAt:created.createdAt.toISOString(),updatedAt:created.updatedAt.toISOString()}));
  }catch(error){
   if((error as {code?:number}).code===11000)return next(new AppError("A group with this name already exists in this season",409,"DUPLICATE_GROUP"));
   next(error);
  }
 };
 update=async(req:Request,res:Response,next:NextFunction):Promise<void>=>{
  try{
   const seasonId=getRequiredRouteParam(req.params.seasonId,"seasonId"),groupId=getRequiredRouteParam(req.params.groupId,"groupId");
   if(!Types.ObjectId.isValid(seasonId)||!Types.ObjectId.isValid(groupId))throw new AppError("Invalid ID",400,"INVALID_ID");
   const season=await SeasonModel.findById(seasonId).select("status").lean().exec();
   if(!season||!["draft","upcoming"].includes(season.status))throw new AppError("Groups can only be edited before activation",409,"GROUPS_LOCKED");
   if(await SeasonMatchModel.countDocuments({seasonRef:seasonId}).exec())throw new AppError("Groups cannot be renamed or reordered after fixtures exist",409,"GROUPS_LOCKED");
   const input=groupUpdateSchema.parse(req.body);
   const group=await GroupModel.findOne({_id:groupId,seasonRef:seasonId}).exec();
   if(!group)throw new AppError("Group not found",404,"GROUP_NOT_FOUND");
   if(input.groupName!==undefined){
    const duplicate=await this.repo.findByName(seasonId,input.groupName);
    if(duplicate&&String(duplicate._id)!==groupId)throw new AppError("A group with this name already exists in this season",409,"DUPLICATE_GROUP");
    group.groupName=input.groupName.trim();group.set("normalizedGroupName",normalizeGroupName(input.groupName));
   }
   if(input.displayOrder!==undefined)group.displayOrder=input.displayOrder;
   await group.save();
   res.status(200).json(ApiResponse.success("Group updated",{...group.toObject(),_id:String(group._id),seasonRef:String(group.seasonRef)}));
  }catch(error){
   if((error as {code?:number}).code===11000)return next(new AppError("A group with this name already exists in this season",409,"DUPLICATE_GROUP"));
   next(error);
  }
 };
 delete=async(req:Request,res:Response,next:NextFunction):Promise<void>=>{
  try{
   const seasonId=getRequiredRouteParam(req.params.seasonId,"seasonId"),groupId=getRequiredRouteParam(req.params.groupId,"groupId");
   if(!Types.ObjectId.isValid(seasonId)||!Types.ObjectId.isValid(groupId))throw new AppError("Invalid ID",400,"INVALID_ID");
   const season=await SeasonModel.findById(seasonId).select("status").lean().exec();
   if(!season||!["draft","upcoming"].includes(season.status))throw new AppError("Groups can only be deleted before activation",409,"GROUPS_LOCKED");
   if(await SeasonMatchModel.countDocuments({seasonRef:seasonId}).exec())throw new AppError("Groups cannot be deleted after fixtures exist",409,"GROUPS_LOCKED");
   const group=await GroupModel.findOne({_id:groupId,seasonRef:seasonId}).lean().exec();
   if(!group)throw new AppError("Group not found",404,"GROUP_NOT_FOUND");
   const teamCount=await SeasonTeamModel.countDocuments({seasonRef:seasonId,groupRef:group._id}).exec();
   if(teamCount)throw new AppError("Remove all SeasonTeam assignments before deleting this group",409,"GROUP_REFERENCED");
   await GroupModel.deleteOne({_id:group._id}).exec();
   res.status(200).json(ApiResponse.success("Unused group deleted",null));
  }catch(error){next(error);}
 };
}
