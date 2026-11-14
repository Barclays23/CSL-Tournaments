import mongoose, { Types } from "mongoose";
import { SeasonModel } from "./season.model.js";
import type { ISeasonRepository } from "./season.interfaces.js";
import type { SeasonEntity, SeasonFields, SeasonListFilter } from "./season.types.js";
import { SeasonTeamModel } from "../seasonTeams/seasonTeam.model.js";
import type { CreateSeasonDto } from "./season.dto.js";
import type { SeasonTeamEntity, SeasonTeamFields } from "../seasonTeams/seasonTeam.types.js";

export class SeasonRepository implements ISeasonRepository {
 async findSeasons(filter:SeasonListFilter):Promise<SeasonEntity[]>{return SeasonModel.find(filter).sort({year:-1,seasonNumber:-1}).lean<SeasonEntity[]>().exec();}
 async findById(id:string):Promise<SeasonEntity|null>{return SeasonModel.findById(id).lean<SeasonEntity>().exec();}
 async findByNumber(number:number):Promise<SeasonEntity|null>{return SeasonModel.findOne({seasonNumber:number}).lean<SeasonEntity>().exec();}
 async findActive(excludeId?:string):Promise<SeasonEntity|null>{return SeasonModel.findOne({status:"active",...(excludeId?{_id:{$ne:new Types.ObjectId(excludeId)}}:{})}).lean<SeasonEntity>().exec();}
 async createWithTeams(data:CreateSeasonDto,teams:Array<{_id:unknown;name:string;logo:SeasonTeamEntity["logoSnapshot"]}>):Promise<SeasonEntity>{
  const session=await mongoose.startSession();
  try{return await session.withTransaction(async()=>{
   const [season]=await SeasonModel.create([{seasonNumber:data.seasonNumber,name:data.name,year:data.year,startDate:data.startDate??null,endDate:data.endDate??null,timeZone:data.timeZone??"Asia/Kolkata",status:data.status??"draft",auctionSettings:data.auctionSettings,pointsRules:data.pointsRules,standingsTieBreakers:data.standingsTieBreakers,matchRules:data.matchRules}],{session});
   if(teams.length) await SeasonTeamModel.insertMany(teams.map(t=>({seasonRef:season._id,teamRef:t._id,displayName:t.name,logoSnapshot:t.logo,status:"registered",managerRefs:[]})),{session,ordered:true});
   return season.toObject() as SeasonEntity;
  });}finally{await session.endSession();}
 }
 async update(id:string,data:Partial<SeasonFields>):Promise<SeasonEntity|null>{return SeasonModel.findByIdAndUpdate(id,{$set:data}, {returnDocument:"after",runValidators:true}).lean<SeasonEntity>().exec();}
 async registerTeamsAtomically(seasonId:string,records:SeasonTeamFields[],limit:number):Promise<SeasonTeamEntity[]>{
  if(!records.length)return [];
  const session=await mongoose.startSession();
  try{
   let created:SeasonTeamEntity[]=[];
   await session.withTransaction(async()=>{
    const lock=await SeasonModel.updateOne({_id:new Types.ObjectId(seasonId),status:{$nin:["completed","archived"]}},{$inc:{auctionRevision:1}},{session}).exec();
    if(lock.matchedCount!==1)throw new Error("SEASON_CLOSED");
    const currentCount=await SeasonTeamModel.countDocuments({seasonRef:new Types.ObjectId(seasonId)}).session(session).exec();
    if(currentCount+records.length>limit)throw new Error("SEASON_TEAM_LIMIT");
    const docs=await SeasonTeamModel.insertMany(records,{session,ordered:true});
    created=docs.map(doc=>doc.toObject() as SeasonTeamEntity);
   });
   return created;
  }finally{await session.endSession();}
 }
 async countLots(seasonId:string):Promise<number>{const {AuctionLotModel}=await import("../auctionLots/auctionLot.model.js");return AuctionLotModel.countDocuments({seasonRef:new Types.ObjectId(seasonId)}).exec();}
}
