import mongoose,{Types} from "mongoose";
import {AppError} from "../../shared/errors/appError.js";
import {SeasonModel} from "../seasons/season.model.js";
import {SeasonTeamModel} from "../seasonTeams/seasonTeam.model.js";
import {TeamModel} from "../teams/team.model.js";
import {PlayerModel} from "../players/player.model.js";
import type {IAuctionLotService} from "./auctionLot.interfaces.js";
import {AuctionLotModel} from "./auctionLot.model.js";
import {AuctionLotRepository} from "./auctionLot.repository.js";
import type {NominatePlayerDto,SellAuctionLotDto,UpdateAuctionLotStatusDto,AuctionLotResponseDto,AuctionSummaryDto,AuctionTeamSummaryDto} from "./auctionLot.dto.js";
import type {AuctionLotEntity} from "./auctionLot.types.js";
export class AuctionLotService implements IAuctionLotService{
 constructor(private readonly lots:AuctionLotRepository){}
 async summary(seasonId:string):Promise<AuctionSummaryDto>{
  this.id(seasonId);const season=await SeasonModel.findById(seasonId).lean().exec();if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  const [teams,lots]=await Promise.all([SeasonTeamModel.find({seasonRef:season._id}).populate({path:"teamRef",select:"name"}).lean().exec(),this.lots.find({seasonRef:new Types.ObjectId(seasonId)})]);
  const summaries:AuctionTeamSummaryDto[]=teams.map(st=>{const teamLots=lots.filter(l=>l.seasonTeamRef&&String(l.seasonTeamRef)===String(st._id)&&l.auctionStatus==="sold");const spent=teamLots.reduce((sum,l)=>sum+(l.purchasePrice??0),0);return {seasonTeamId:String(st._id),teamId:String(st.teamRef),displayName:st.displayName,logoSnapshot:st.logoSnapshot,status:st.status,budget:season.auctionSettings.budgetPerTeam,playersSigned:teamLots.length,remainingSlots:season.auctionSettings.teamSquadSize-teamLots.length,totalSpent:spent,balance:season.auctionSettings.budgetPerTeam-spent,averagePrice:teamLots.length?spent/teamLots.length:0,iconCount:teamLots.filter(l=>l.isIconPlayer).length,goalkeeperCount:teamLots.filter(l=>l.isGoalkeeper).length,lots:teamLots.map(l=>this.map(l))};});
  return {season:{_id:String(season._id),name:season.name,year:season.year,status:season.status,auctionSettings:season.auctionSettings},totals:{participatingTeams:teams.length,lots:lots.length,sold:lots.filter(l=>l.auctionStatus==="sold").length,pending:lots.filter(l=>l.auctionStatus==="pending").length,unsold:lots.filter(l=>l.auctionStatus==="unsold").length,withdrawn:lots.filter(l=>l.auctionStatus==="withdrawn").length,totalSoldValue:lots.filter(l=>l.auctionStatus==="sold").reduce((s,l)=>s+(l.purchasePrice??0),0)},teams:summaries,lots:lots.map(l=>this.map(l))};
 }
 async nominate(input:NominatePlayerDto):Promise<AuctionLotResponseDto>{
  this.id(input.seasonId);this.id(input.playerId);const season=await SeasonModel.findById(input.seasonId).lean().exec();if(!season||["completed","archived"].includes(season.status))throw new AppError("Season is not open for nominations",409,"SEASON_CLOSED");
  const player=await PlayerModel.findById(input.playerId).lean().exec();if(!player||player.status!=="active")throw new AppError("Active player not found",404,"PLAYER_NOT_FOUND");
  if(await this.lots.count({seasonRef:new Types.ObjectId(input.seasonId)})>=season.auctionSettings.playersCount)throw new AppError("Season player nomination limit reached",422,"AUCTION_PLAYER_LIMIT");
  try{const created=await this.lots.create({seasonRef:new Types.ObjectId(input.seasonId),seasonTeamRef:null,playerRef:new Types.ObjectId(input.playerId),lotNumber:null,auctionStatus:"pending",purchasePrice:null,playerPosition:input.playerPosition,isIconPlayer:!!input.isIconPlayer,isGoalkeeper:!!input.isGoalkeeper,jerseyNo:null,nominatedAt:new Date(),soldAt:null});return this.map(created);}catch(e){if((e as {code?:number}).code===11000)throw new AppError("This player is already nominated in this season",409,"DUPLICATE_SEASON_PLAYER");throw e;}
 }
 async sell(id:string,input:SellAuctionLotDto):Promise<AuctionLotResponseDto>{
  this.id(id);this.id(input.seasonTeamId);if(input.purchasePrice<0)throw new AppError("Purchase price cannot be negative",422,"INVALID_PRICE");
  const session=await mongoose.startSession();let saved:AuctionLotEntity|null=null;
  try{await session.withTransaction(async()=>{
   const lot=await AuctionLotModel.findById(id).session(session).exec();if(!lot||lot.auctionStatus!=="pending")throw new AppError("Only pending lots can be sold",409,"LOT_NOT_PENDING");
   const season=await SeasonModel.findById(lot.seasonRef).session(session).exec();const team=await SeasonTeamModel.findById(input.seasonTeamId).session(session).exec();
   if(!season||!team||String(team.seasonRef)!==String(lot.seasonRef)||team.status==="withdrawn")throw new AppError("Winning team must participate in the same season",422,"INVALID_SEASON_TEAM");
   const [soldCount,spent,icons,gks,player,jerseyCount]=await Promise.all([
    AuctionLotModel.countDocuments({seasonTeamRef:team._id,auctionStatus:"sold"}).session(session),
    AuctionLotModel.aggregate([{$match:{seasonTeamRef:team._id,auctionStatus:"sold"}},{$group:{_id:null,total:{$sum:"$purchasePrice"}}}]).session(session),
    AuctionLotModel.countDocuments({seasonTeamRef:team._id,auctionStatus:"sold",isIconPlayer:true}).session(session),
    AuctionLotModel.countDocuments({seasonTeamRef:team._id,auctionStatus:"sold",isGoalkeeper:true}).session(session),
    PlayerModel.findById(lot.playerRef).session(session).lean().exec(),
    input.jerseyNo==null?Promise.resolve(0):AuctionLotModel.countDocuments({seasonTeamRef:team._id,jerseyNo:input.jerseyNo,auctionStatus:"sold"}).session(session)
   ]);
   if(!player||player.status!=="active")throw new AppError("Player is no longer active",409,"PLAYER_UNAVAILABLE");
   const total=Number(spent[0]?.total??0);if(total+input.purchasePrice>season.auctionSettings.budgetPerTeam)throw new AppError("Sale exceeds the team's remaining budget",422,"AUCTION_BUDGET_EXCEEDED");
   if(soldCount>=season.auctionSettings.teamSquadSize)throw new AppError("Team squad size limit reached",422,"SQUAD_LIMIT");
   if(lot.isIconPlayer&&icons>=season.auctionSettings.iconPlayerLimit)throw new AppError("Team Icon Player limit reached",422,"ICON_LIMIT");
   if(lot.isGoalkeeper&&gks>=season.auctionSettings.goalkeeperLimit)throw new AppError("Team Goalkeeper limit reached",422,"GOALKEEPER_LIMIT");
   if(jerseyCount)throw new AppError("Jersey number already exists in this season team",409,"DUPLICATE_JERSEY");
   await SeasonModel.updateOne({_id:season._id},{$inc:{auctionRevision:1}},{session});\n   lot.seasonTeamRef=team._id;lot.purchasePrice=input.purchasePrice;lot.jerseyNo=input.jerseyNo??null;lot.auctionStatus="sold";lot.soldAt=new Date();await lot.save({session});saved=lot.toObject() as AuctionLotEntity;
  });}finally{await session.endSession();}
  if(!saved)throw new AppError("Auction sale failed",500,"AUCTION_SALE_FAILED");return this.map(saved);
 }
 async updateStatus(id:string,input:UpdateAuctionLotStatusDto):Promise<AuctionLotResponseDto>{
  this.id(id);const lot=await AuctionLotModel.findById(id).exec();if(!lot)throw new AppError("Auction lot not found",404,"LOT_NOT_FOUND");
  if(lot.auctionStatus==="sold")throw new AppError("Sold lots cannot be changed to unsold or withdrawn; use a reviewed correction workflow",409,"SOLD_LOT_LOCKED");
  if(!["pending","unsold","withdrawn"].includes(lot.auctionStatus))throw new AppError("Invalid lot transition",409,"INVALID_LOT_TRANSITION");
  lot.auctionStatus=input.auctionStatus;lot.seasonTeamRef=null;lot.purchasePrice=null;lot.soldAt=null;await lot.save();return this.map(lot.toObject() as AuctionLotEntity);
 }
 private map(l:AuctionLotEntity):AuctionLotResponseDto{return {_id:String(l._id),seasonRef:String(l.seasonRef),seasonTeamRef:l.seasonTeamRef?String(l.seasonTeamRef):null,playerRef:l.playerRef as unknown as string,lotNumber:l.lotNumber,auctionStatus:l.auctionStatus,purchasePrice:l.purchasePrice,playerPosition:l.playerPosition,isIconPlayer:l.isIconPlayer,isGoalkeeper:l.isGoalkeeper,jerseyNo:l.jerseyNo,nominatedAt:l.nominatedAt?.toISOString()??null,soldAt:l.soldAt?.toISOString()??null};}
 private id(id:string){if(!Types.ObjectId.isValid(id))throw new AppError("Invalid ID",400,"INVALID_ID");}
}
