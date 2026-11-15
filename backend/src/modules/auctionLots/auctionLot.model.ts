import {Schema,model} from "mongoose";
import type {AuctionLotFields} from "./auctionLot.types.js";
const schema=new Schema<AuctionLotFields>({
 seasonRef:{type:Schema.Types.ObjectId,ref:"Season",required:true,immutable:true},
 seasonTeamRef:{type:Schema.Types.ObjectId,ref:"SeasonTeam",default:null},
 playerRef:{type:Schema.Types.ObjectId,ref:"Player",required:true,immutable:true},
 lotNumber:{type:Number,min:1,default:null},
 auctionStatus:{type:String,enum:["pending","sold","unsold","withdrawn"],default:"pending",required:true},
 purchasePrice:{type:Number,min:0,default:null},
 playerPosition:{type:String,enum:["goalkeeper","defender","midfielder","forward"],required:true},
 isIconPlayer:{type:Boolean,default:false},isGoalkeeper:{type:Boolean,default:false},
 jerseyNo:{type:Number,min:1,default:null},nominatedAt:{type:Date,default:Date.now},soldAt:{type:Date,default:null}
},{timestamps:true,versionKey:false});
schema.index({seasonRef:1,playerRef:1},{unique:true});
schema.index({seasonRef:1,seasonTeamRef:1,auctionStatus:1});
schema.index({seasonRef:1,playerPosition:1,auctionStatus:1});
schema.index({playerRef:1,seasonRef:-1});
export const AuctionLotModel=model<AuctionLotFields>("AuctionLot",schema);
