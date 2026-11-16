import mongoose,{Types} from "mongoose";
import {AppError} from "../../shared/errors/appError.js";
import {ManagerModel} from "../managers/manager.model.js";
import {SeasonModel} from "../seasons/season.model.js";
import {GroupModel} from "../groups/group.model.js";
import {SeasonTeamModel} from "./seasonTeam.model.js";
import {AuctionLotModel} from "../auctionLots/auctionLot.model.js";
import {SeasonMatchModel} from "../matches/seasonMatch.model.js";
import type {ISeasonTeamService} from "./seasonTeam.interfaces.js";
import type {SeasonTeamResponseDto,UpdateSeasonTeamDto} from "./seasonTeam.dto.js";
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
  if(input.managerIds){
   const ids=input.managerIds.map(x=>new Types.ObjectId(x));
   const activeCount=await ManagerModel.countDocuments({_id:{$in:ids},status:"active"}).exec();
   if(activeCount!==ids.length)throw new AppError("All assigned managers must be active",422,"INVALID_MANAGER_ASSIGNMENT");
   current.managerRefs=ids;
  }
  if(input.groupId!==undefined){
   const fixtureCount=await SeasonMatchModel.countDocuments({seasonRef:current.seasonRef}).exec();
   if(fixtureCount>0)throw new AppError("Group assignment is locked after fixtures exist. Use an audited correction workflow for a genuine correction.",409,"GROUP_ASSIGNMENT_LOCKED");
   if(season.status==="active")throw new AppError("Group assignment is frozen after activation",409,"GROUP_ASSIGNMENT_LOCKED");
   if(input.groupId===null)current.groupRef=null;
   else{
    const group=await GroupModel.findById(input.groupId).lean().exec();
    if(!group||String(group.seasonRef)!==String(current.seasonRef))throw new AppError("Group must belong to the same season",422,"INVALID_GROUP");
    current.groupRef=group._id;
   }
  }
  await current.save();
  const updated=await SeasonTeamModel.findById(id).populate({path:"teamRef",select:"name shortName logo"}).populate({path:"groupRef",select:"groupName displayOrder"}).populate({path:"managerRefs",select:"name role profilePic"}).lean().exec();
  if(!updated)throw new AppError("Season team not found",404,"SEASON_TEAM_NOT_FOUND");return this.map(updated as any);
 }

 async remove(seasonId:string,id:string):Promise<void>{
  this.id(seasonId);this.id(id);
  const session=await mongoose.startSession();
  try{
   await session.withTransaction(async()=>{
    const season=await SeasonModel.findById(seasonId).select("status").session(session).lean().exec();
    if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
    if(!["draft","upcoming"].includes(season.status))throw new AppError("SeasonTeam registrations can only be removed before activation",409,"SEASON_REGISTRATION_FROZEN");
    const revision=await SeasonModel.updateOne(
     {_id:new Types.ObjectId(seasonId),status:{$in:["draft","upcoming"]}},
     {$inc:{auctionRevision:1}},
     {session}
    ).exec();
    if(revision.matchedCount!==1)throw new AppError("Season state changed while removing this registration. Refresh and try again.",409,"SEASON_STATE_CONFLICT");
    const record=await SeasonTeamModel.findOne({_id:id,seasonRef:seasonId}).session(session).lean().exec();
    if(!record)throw new AppError("Season team not found",404,"SEASON_TEAM_NOT_FOUND");
    const [lots,matches]=await Promise.all([
     AuctionLotModel.countDocuments({seasonRef:seasonId,seasonTeamRef:id}).session(session).exec(),
     SeasonMatchModel.countDocuments({seasonRef:seasonId,$or:[{homeSeasonTeamRef:id},{awaySeasonTeamRef:id}]}).session(session).exec()
    ]);
    if(lots||matches)throw new AppError("This registration has auction or fixture history and cannot be removed. Use controlled withdrawal instead.",409,"SEASON_TEAM_REFERENCED");
    await SeasonTeamModel.deleteOne({_id:id,seasonRef:seasonId}).session(session).exec();
   });
  }finally{await session.endSession();}
 }
 async withdraw(seasonId:string,id:string):Promise<SeasonTeamResponseDto>{
  this.id(seasonId);this.id(id);
  const session=await mongoose.startSession();
  try{
   await session.withTransaction(async()=>{
    const season=await SeasonModel.findById(seasonId).select("status").session(session).lean().exec();
    if(!season||season.status!=="active")throw new AppError("Controlled withdrawal is available only during an Active season",409,"SEASON_WITHDRAWAL_NOT_ALLOWED");
    const revision=await SeasonModel.updateOne(
     {_id:new Types.ObjectId(seasonId),status:"active"},
     {$inc:{auctionRevision:1}},
     {session}
    ).exec();
    if(revision.matchedCount!==1)throw new AppError("Season state changed while withdrawing this team. Refresh and try again.",409,"SEASON_STATE_CONFLICT");
    const current=await SeasonTeamModel.findOne({_id:id,seasonRef:seasonId}).session(session).exec();
    if(!current)throw new AppError("Season team not found",404,"SEASON_TEAM_NOT_FOUND");
    if(current.status==="withdrawn")throw new AppError("This team has already withdrawn",409,"SEASON_TEAM_ALREADY_WITHDRAWN");
    const fixtures=await SeasonMatchModel.find({seasonRef:seasonId,$or:[{homeSeasonTeamRef:id},{awaySeasonTeamRef:id}],status:{$in:["live","scheduled","postponed"]}})
     .select("matchNumber status kickoffAt").session(session).lean().exec();
    const live=fixtures.filter(match=>match.status==="live");
    if(live.length)throw new AppError("A team cannot withdraw while it has a live match",409,"WITHDRAWAL_LIVE_MATCH",
     Object.fromEntries(live.map((match,index)=>["match."+(index+1),"Match "+match.matchNumber+" is live"])));
    const unresolved=fixtures.filter(match=>match.status==="scheduled"||match.status==="postponed");
    if(unresolved.length)throw new AppError("Reschedule or explicitly cancel all scheduled/postponed fixtures before withdrawing this team",409,"WITHDRAWAL_FIXTURES_UNRESOLVED",
     Object.fromEntries(unresolved.map((match,index)=>["fixture."+(index+1),"Match "+match.matchNumber+" is "+match.status])));
    current.status="withdrawn";
    await current.save({session});
   });
  }finally{await session.endSession();}
  const updated=await SeasonTeamModel.findOne({_id:id,seasonRef:seasonId}).populate({path:"teamRef",select:"name shortName logo"}).populate({path:"groupRef",select:"groupName displayOrder"}).populate({path:"managerRefs",select:"name role profilePic"}).lean().exec();
  if(!updated)throw new AppError("Season team not found",404,"SEASON_TEAM_NOT_FOUND");
  return this.map(updated as any);
 }
 private map(r:any):SeasonTeamResponseDto{return {_id:String(r._id),seasonRef:String(r.seasonRef),teamRef:String(r.teamRef?._id??r.teamRef),displayName:r.displayName,logoSnapshot:r.logoSnapshot,groupRef:r.groupRef?String(r.groupRef._id??r.groupRef):null,managerRefs:(r.managerRefs??[]).map((m:any)=>String(m._id??m)),status:r.status,team:r.teamRef&&typeof r.teamRef==="object"&&r.teamRef.name?{_id:String(r.teamRef._id),name:r.teamRef.name,shortName:r.teamRef.shortName,logo:r.teamRef.logo}:null,group:r.groupRef?.groupName?{_id:String(r.groupRef._id),groupName:r.groupRef.groupName,displayOrder:r.groupRef.displayOrder}:null,managers:(r.managerRefs??[]).filter((m:any)=>m.name).map((m:any)=>({_id:String(m._id),name:m.name,role:m.role,profilePic:m.profilePic})),createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString()};}
 private id(value:string){if(!Types.ObjectId.isValid(value))throw new AppError("Invalid ID",400,"INVALID_ID");}
}
