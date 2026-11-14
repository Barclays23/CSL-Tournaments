import {Types} from "mongoose";
import {AppError} from "../../shared/errors/appError.js";
import {ManagerModel} from "../managers/manager.model.js";
import {SeasonModel} from "../seasons/season.model.js";
import {GroupModel} from "../groups/group.model.js";
import {SeasonTeamModel} from "./seasonTeam.model.js";
import {SeasonMatchModel} from "../matches/seasonMatch.model.js";
import type {ISeasonTeamService} from "./seasonTeam.interfaces.js";
import type {SeasonTeamResponseDto,UpdateSeasonTeamDto} from "./seasonTeam.dto.js";
import type {SeasonTeamStatus} from "./seasonTeam.types.js";
export class SeasonTeamService implements ISeasonTeamService{
 async list(seasonId:string):Promise<SeasonTeamResponseDto[]>{
  this.id(seasonId);const season=await SeasonModel.findById(seasonId).select("_id").lean().exec();if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  const records=await SeasonTeamModel.find({seasonRef:season._id}).sort({displayName:1}).populate({path:"teamRef",select:"name shortName logo"}).populate({path:"groupRef",select:"groupName displayOrder"}).populate({path:"managerRefs",select:"name role profilePic"}).lean().exec();
  return records.map((r:any)=>this.map(r));
 }
 async update(id:string,input:UpdateSeasonTeamDto):Promise<SeasonTeamResponseDto>{
  this.id(id);const current=await SeasonTeamModel.findById(id).exec();if(!current)throw new AppError("Season team not found",404,"SEASON_TEAM_NOT_FOUND");
  const season=await SeasonModel.findById(current.seasonRef).select("status").lean().exec();if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  if(["completed","archived"].includes(season.status))throw new AppError("Completed or archived season participation is read-only",409,"SEASON_CLOSED");
  if(input.status==="withdrawn"){
   const [lots,matches]=await Promise.all([
    (await import("../auctionLots/auctionLot.model.js")).AuctionLotModel.countDocuments({seasonTeamRef:current._id,auctionStatus:"sold"}).exec(),
    SeasonMatchModel.countDocuments({$or:[{homeSeasonTeamRef:current._id},{awaySeasonTeamRef:current._id}]}).exec()
   ]);
   if(lots||matches)throw new AppError("Cannot withdraw a team with sold players or fixtures; correct those records first",409,"SEASON_TEAM_REFERENCED");
  }
  if(input.managerIds){
   const ids=input.managerIds.map(x=>new Types.ObjectId(x));
   const activeCount=await ManagerModel.countDocuments({_id:{$in:ids},status:"active"}).exec();
   if(activeCount!==ids.length)throw new AppError("All assigned managers must be active",422,"INVALID_MANAGER_ASSIGNMENT");
   current.managerRefs=ids;
  }
  if(input.groupId!==undefined){
   if(input.groupId===null)current.groupRef=null;
   else{
    const group=await GroupModel.findById(input.groupId).lean().exec();
    if(!group||String(group.seasonRef)!==String(current.seasonRef))throw new AppError("Group must belong to the same season",422,"INVALID_GROUP");
    current.groupRef=group._id;
   }
  }
  if(input.status!==undefined)current.status=input.status as SeasonTeamStatus;
  await current.save();
  const updated=await SeasonTeamModel.findById(id).populate({path:"teamRef",select:"name shortName logo"}).populate({path:"groupRef",select:"groupName displayOrder"}).populate({path:"managerRefs",select:"name role profilePic"}).lean().exec();
  if(!updated)throw new AppError("Season team not found",404,"SEASON_TEAM_NOT_FOUND");return this.map(updated as any);
 }
 private map(r:any):SeasonTeamResponseDto{return {_id:String(r._id),seasonRef:String(r.seasonRef),teamRef:String(r.teamRef?._id??r.teamRef),displayName:r.displayName,logoSnapshot:r.logoSnapshot,groupRef:r.groupRef?String(r.groupRef._id??r.groupRef):null,managerRefs:(r.managerRefs??[]).map((m:any)=>String(m._id??m)),status:r.status,team:r.team?{_id:String(r.team._id),name:r.team.name,shortName:r.team.shortName,logo:r.team.logo}:null,group:r.groupRef?.groupName?{_id:String(r.groupRef._id),groupName:r.groupRef.groupName,displayOrder:r.groupRef.displayOrder}:null,managers:(r.managerRefs??[]).filter((m:any)=>m.name).map((m:any)=>({_id:String(m._id),name:m.name,role:m.role,profilePic:m.profilePic})),createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString()};}
 private id(value:string){if(!Types.ObjectId.isValid(value))throw new AppError("Invalid ID",400,"INVALID_ID");}
}
