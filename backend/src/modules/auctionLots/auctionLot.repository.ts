import {Types,type ClientSession} from "mongoose";
import {AuctionLotModel} from "./auctionLot.model.js";
import {PlayerModel} from "../players/player.model.js";
import {SeasonModel} from "../seasons/season.model.js";
import {SeasonTeamModel} from "../seasonTeams/seasonTeam.model.js";
import type {AuctionLotEntity,AuctionLotFields,AuctionLotQuery,ISeasonRosterLookupRepository} from "./auctionLot.types.js";
const populate=[{path:"playerRef",select:"name profilePic"},{path:"seasonTeamRef",select:"displayName logoSnapshot teamRef",populate:{path:"teamRef",select:"name shortName logo"}}];
export class AuctionLotRepository implements ISeasonRosterLookupRepository{
 async isPlayerSoldToTeamInActiveSeason(playerId:string,teamId:string):Promise<boolean>{
  if(!Types.ObjectId.isValid(playerId)||!Types.ObjectId.isValid(teamId))return false;
  const season=await SeasonModel.findOne({status:"active"}).select("_id").lean<{_id:Types.ObjectId}|null>().exec();
  if(!season)return false;
  const seasonTeam=await SeasonTeamModel.findOne({seasonRef:season._id,teamRef:new Types.ObjectId(teamId),status:{$nin:["withdrawn","eliminated","completed"]}}).select("_id").lean<{_id:Types.ObjectId}|null>().exec();
  if(!seasonTeam)return false;
  return Boolean(await AuctionLotModel.exists({seasonRef:season._id,playerRef:new Types.ObjectId(playerId),seasonTeamRef:seasonTeam._id,auctionStatus:"sold"}).exec());
 }
 async find(query:AuctionLotQuery):Promise<AuctionLotEntity[]>{return AuctionLotModel.find(query).sort({lotNumber:1,createdAt:1}).populate(populate).lean<AuctionLotEntity[]>().exec();}
 async findById(id:string,session?:ClientSession):Promise<AuctionLotEntity|null>{return AuctionLotModel.findById(id).session(session??null).lean<AuctionLotEntity>().exec();}
 async findPopulatedById(id:string):Promise<AuctionLotEntity|null>{return AuctionLotModel.findById(id).populate(populate).lean<AuctionLotEntity>().exec();}
 async findPlayerIdsByName(name:string):Promise<Types.ObjectId[]>{const players=await PlayerModel.find({name:{$regex:name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),$options:"i"}}).select("_id").limit(250).lean<{_id:Types.ObjectId}[]>().exec();return players.map(p=>p._id);}
 async create(data:AuctionLotFields,session?:ClientSession):Promise<AuctionLotEntity>{const [doc]=await AuctionLotModel.create([data],{session});return doc.toObject() as unknown as AuctionLotEntity;}
 async update(id:string,data:Partial<AuctionLotFields>,session?:ClientSession):Promise<AuctionLotEntity|null>{return AuctionLotModel.findByIdAndUpdate(id,{$set:data},{session,returnDocument:"after",runValidators:true}).lean<AuctionLotEntity>().exec();}
 async count(query:Partial<AuctionLotQuery>,session?:ClientSession):Promise<number>{return AuctionLotModel.countDocuments(query).session(session??null).exec();}
 async sumSold(seasonTeamId:string,session?:ClientSession):Promise<number>{const rows=await AuctionLotModel.aggregate<{total:number}>([{$match:{seasonTeamRef:new Types.ObjectId(seasonTeamId),auctionStatus:"sold"}},{$group:{_id:null,total:{$sum:"$purchasePrice"}}}]).session(session??null).exec();return rows[0]?.total??0;}
 async countFlags(seasonTeamId:string,flag:"isIconPlayer"|"isGoalkeeper",session?:ClientSession):Promise<number>{return AuctionLotModel.countDocuments({seasonTeamRef:new Types.ObjectId(seasonTeamId),auctionStatus:"sold",[flag]:true}).session(session??null).exec();}
}
