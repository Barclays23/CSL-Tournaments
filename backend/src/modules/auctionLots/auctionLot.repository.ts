import {Types,type ClientSession} from "mongoose";
import {AuctionLotModel} from "./auctionLot.model.js";
import type {AuctionLotEntity,AuctionLotFields,AuctionLotQuery} from "./auctionLot.types.js";
const populate=[{path:"playerRef",select:"name profilePic"},{path:"seasonTeamRef",populate:{path:"teamRef",select:"name shortName logo"}}];
export class AuctionLotRepository{
 async find(query:AuctionLotQuery):Promise<AuctionLotEntity[]>{return AuctionLotModel.find(query).sort({lotNumber:1,createdAt:1}).populate(populate).lean<AuctionLotEntity[]>().exec();}
 async findById(id:string,session?:ClientSession):Promise<AuctionLotEntity|null>{return AuctionLotModel.findById(id).session(session??null).lean<AuctionLotEntity>().exec();}
 async create(data:AuctionLotFields,session?:ClientSession):Promise<AuctionLotEntity>{const [doc]=await AuctionLotModel.create([data],{session});return doc.toObject() as AuctionLotEntity;}
 async update(id:string,data:Partial<AuctionLotFields>,session?:ClientSession):Promise<AuctionLotEntity|null>{return AuctionLotModel.findByIdAndUpdate(id,{$set:data},{session,returnDocument:"after",runValidators:true}).lean<AuctionLotEntity>().exec();}
 async count(query:Partial<AuctionLotQuery>,session?:ClientSession):Promise<number>{return AuctionLotModel.countDocuments(query).session(session??null).exec();}
 async sumSold(seasonTeamId:string,session?:ClientSession):Promise<number>{const rows=await AuctionLotModel.aggregate<{total:number}>([{$match:{seasonTeamRef:new Types.ObjectId(seasonTeamId),auctionStatus:"sold"}},{$group:{_id:null,total:{$sum:"$purchasePrice"}}}]).session(session??null).exec();return rows[0]?.total??0;}
 async countFlags(seasonTeamId:string,flag:"isIconPlayer"|"isGoalkeeper",session?:ClientSession):Promise<number>{return AuctionLotModel.countDocuments({seasonTeamRef:new Types.ObjectId(seasonTeamId),auctionStatus:"sold",[flag]:true}).session(session??null).exec();}
}
