import mongoose,{Types} from "mongoose";
import {AppError} from "../../shared/errors/appError.js";
import {SeasonModel} from "../seasons/season.model.js";
import {SeasonTeamModel} from "../seasonTeams/seasonTeam.model.js";
import {TeamModel} from "../teams/team.model.js";
import {PlayerModel} from "../players/player.model.js";
import type {IAuctionLotService} from "./auctionLot.interfaces.js";
import {AuctionLotModel} from "./auctionLot.model.js";
import {AuctionLotRepository} from "./auctionLot.repository.js";
import type {NominatePlayerDto,SellAuctionLotDto,UpdateAuctionLotStatusDto,UpdateAuctionLotDto,AuctionLotResponseDto,AuctionSummaryDto,AuctionTeamSummaryDto,AuctionLotsQueryDto} from "./auctionLot.dto.js";
import type {AuctionLotEntity} from "./auctionLot.types.js";
export class AuctionLotService implements IAuctionLotService{
 constructor(private readonly lots:AuctionLotRepository){}
 async summary(seasonId:string):Promise<AuctionSummaryDto>{
  this.id(seasonId);const season=await SeasonModel.findById(seasonId).lean().exec();if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  if(!season.auctionSettings)throw new AppError("Auction settings are unavailable for this historical season",409,"SEASON_RULES_UNAVAILABLE");
  const [teams,lots]=await Promise.all([SeasonTeamModel.find({seasonRef:season._id}).populate({path:"teamRef",select:"name"}).lean().exec(),this.lots.find({seasonRef:new Types.ObjectId(seasonId)})]);
  const summaries:AuctionTeamSummaryDto[]=teams.map(st=>{const teamLots=lots.filter(l=>l.seasonTeamRef&&this.refId(l.seasonTeamRef)===String(st._id)&&l.auctionStatus==="sold");const spent=teamLots.reduce((sum,l)=>sum+(l.purchasePrice??0),0);return {seasonTeamId:String(st._id),teamId:this.refId(st.teamRef),displayName:st.displayName,logoSnapshot:st.logoSnapshot,status:st.status,budget:season.auctionSettings.budgetPerTeam,playersSigned:teamLots.length,remainingSlots:season.auctionSettings.teamSquadSize-teamLots.length,totalSpent:spent,balance:season.auctionSettings.budgetPerTeam-spent,averagePrice:teamLots.length?spent/teamLots.length:0,iconCount:teamLots.filter(l=>l.isIconPlayer).length,goalkeeperCount:teamLots.filter(l=>l.playerPosition==="goalkeeper").length,lots:teamLots.map(l=>this.map(l))};});
  return {season:{_id:String(season._id),name:season.name,year:season.year,status:season.status,auctionSettings:season.auctionSettings},totals:{participatingTeams:teams.length,lots:lots.length,sold:lots.filter(l=>l.auctionStatus==="sold").length,pending:lots.filter(l=>l.auctionStatus==="pending").length,unsold:lots.filter(l=>l.auctionStatus==="unsold").length,withdrawn:lots.filter(l=>l.auctionStatus==="withdrawn").length,totalSoldValue:lots.filter(l=>l.auctionStatus==="sold").reduce((s,l)=>s+(l.purchasePrice??0),0)},teams:summaries,lots:lots.map(l=>this.map(l))};
 }
 async list(query:AuctionLotsQueryDto):Promise<AuctionLotResponseDto[]>{
  this.id(query.seasonId);
  const season=await SeasonModel.findById(query.seasonId).select("_id").lean().exec();if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  const filter:import("./auctionLot.types.js").AuctionLotQuery={seasonRef:new Types.ObjectId(query.seasonId)};
  if(query.seasonTeamId)filter.seasonTeamRef=new Types.ObjectId(query.seasonTeamId);
  if(query.playerPosition)filter.playerPosition=query.playerPosition;
  if(query.auctionStatus)filter.auctionStatus=query.auctionStatus;
  if(query.isIconPlayer!==undefined)filter.isIconPlayer=query.isIconPlayer;
  if(query.isGoalkeeper!==undefined)filter.isGoalkeeper=query.isGoalkeeper;
  if(query.playerName){const ids=await this.lots.findPlayerIdsByName(query.playerName);if(!ids.length)return [];filter.playerRef={$in:ids};}
  return (await this.lots.find(filter)).map(l=>this.map(l));
 }
 async nominate(input:NominatePlayerDto):Promise<AuctionLotResponseDto>{
  this.id(input.seasonId);this.id(input.playerId);
  const player=await PlayerModel.findById(input.playerId).lean().exec();
  if(!player||player.status!=="active")throw new AppError("Active player not found",404,"PLAYER_NOT_FOUND");
  const session=await mongoose.startSession();let created:AuctionLotEntity|null=null;
  try{
   await session.withTransaction(async()=>{
    const season=await SeasonModel.findById(input.seasonId).session(session).lean().exec();
    if(!season||["completed","archived"].includes(season.status))throw new AppError("Season is not open for nominations",409,"SEASON_CLOSED");
    if(!season.auctionSettings)throw new AppError("Auction settings are unavailable for this season",409,"SEASON_RULES_UNAVAILABLE");
    const lock=await SeasonModel.updateOne({_id:season._id,status:{$nin:["completed","archived"]}},{$inc:{auctionRevision:1}},{session}).exec();
    if(lock.matchedCount!==1)throw new AppError("Season is not open for nominations",409,"SEASON_CLOSED");
    const count=await this.lots.count({seasonRef:new Types.ObjectId(input.seasonId)},session);
    if(count>=season.auctionSettings.playersCount)throw new AppError("Season player nomination limit reached",422,"AUCTION_PLAYER_LIMIT");
    created=await this.lots.create({seasonRef:new Types.ObjectId(input.seasonId),seasonTeamRef:null,playerRef:new Types.ObjectId(input.playerId),lotNumber:null,auctionStatus:"pending",purchasePrice:null,playerPosition:input.playerPosition,isIconPlayer:!!input.isIconPlayer,isGoalkeeper:input.playerPosition==="goalkeeper",jerseyNo:null,nominatedAt:new Date(),soldAt:null},session);
   });
  }catch(error){
   if((error as {code?:number}).code===11000)throw new AppError("This player is already nominated in this season",409,"DUPLICATE_SEASON_PLAYER");
   throw error;
  }finally{await session.endSession();}
  if(!created)throw new AppError("Player nomination failed",500,"AUCTION_NOMINATION_FAILED");
  const populated=await this.lots.findPopulatedById(String(created._id));
  return this.map(populated??created);
 }
 async sell(id:string,input:SellAuctionLotDto):Promise<AuctionLotResponseDto>{
  this.id(id);this.id(input.seasonTeamId);if(input.purchasePrice<0)throw new AppError("Purchase price cannot be negative",422,"INVALID_PRICE");
  const session=await mongoose.startSession();let saved:AuctionLotEntity|null=null;
  try{await session.withTransaction(async()=>{
   const lot=await AuctionLotModel.findById(id).session(session).exec();if(!lot||lot.auctionStatus!=="pending")throw new AppError("Only pending lots can be sold",409,"LOT_NOT_PENDING");
   const season=await SeasonModel.findById(lot.seasonRef).session(session).exec();const team=await SeasonTeamModel.findById(input.seasonTeamId).session(session).exec();
   if(!season||!team||String(team.seasonRef)!==String(lot.seasonRef)||["withdrawn","eliminated","completed"].includes(team.status))throw new AppError("Winning team must participate in the same season",422,"INVALID_SEASON_TEAM");
   if(!season.auctionSettings)throw new AppError("Auction settings are unavailable for this season",409,"SEASON_RULES_UNAVAILABLE");
   const [soldCount,spent,icons,gks,player,jerseyCount]=await Promise.all([
    AuctionLotModel.countDocuments({seasonTeamRef:team._id,auctionStatus:"sold"}).session(session),
    AuctionLotModel.aggregate([{$match:{seasonTeamRef:team._id,auctionStatus:"sold"}},{$group:{_id:null,total:{$sum:"$purchasePrice"}}}]).session(session),
    AuctionLotModel.countDocuments({seasonTeamRef:team._id,auctionStatus:"sold",isIconPlayer:true}).session(session),
    AuctionLotModel.countDocuments({seasonTeamRef:team._id,auctionStatus:"sold",playerPosition:"goalkeeper"}).session(session),
    PlayerModel.findById(lot.playerRef).session(session).lean().exec(),
    input.jerseyNo==null?Promise.resolve(0):AuctionLotModel.countDocuments({seasonTeamRef:team._id,jerseyNo:input.jerseyNo,auctionStatus:"sold"}).session(session)
   ]);
   if(!player||player.status!=="active")throw new AppError("Player is no longer active",409,"PLAYER_UNAVAILABLE");
   const total=Number(spent[0]?.total??0);if(total+input.purchasePrice>season.auctionSettings.budgetPerTeam)throw new AppError("Sale exceeds the team's remaining budget",422,"AUCTION_BUDGET_EXCEEDED");
   if(soldCount>=season.auctionSettings.teamSquadSize)throw new AppError("Team squad size limit reached",422,"SQUAD_LIMIT");
   if(lot.isIconPlayer&&icons>=season.auctionSettings.iconPlayerLimit)throw new AppError("Team Icon Player limit reached",422,"ICON_LIMIT");
   if(lot.playerPosition==="goalkeeper"&&gks>=season.auctionSettings.goalkeeperLimit)throw new AppError("Team Goalkeeper limit reached",422,"GOALKEEPER_LIMIT");
   if(jerseyCount)throw new AppError("Jersey number already exists in this season team",409,"DUPLICATE_JERSEY");
   await SeasonModel.updateOne({_id:season._id},{$inc:{auctionRevision:1}},{session});
   lot.seasonTeamRef=team._id;lot.purchasePrice=input.purchasePrice;lot.jerseyNo=input.jerseyNo??null;lot.auctionStatus="sold";lot.isGoalkeeper=lot.playerPosition==="goalkeeper";lot.soldAt=new Date();await lot.save({session});saved=lot.toObject() as AuctionLotEntity;
  });}finally{await session.endSession();}
  if(!saved)throw new AppError("Auction sale failed",500,"AUCTION_SALE_FAILED");return this.map(saved);
 }
 async updateStatus(id:string,input:UpdateAuctionLotStatusDto):Promise<AuctionLotResponseDto>{
  return this.update(id,{auctionStatus:input.auctionStatus});
 }
 async update(id:string,input:UpdateAuctionLotDto):Promise<AuctionLotResponseDto>{
  this.id(id);
  const session=await mongoose.startSession();
  let saved:AuctionLotEntity|null=null;
  try{
   await session.withTransaction(async()=>{
    const lot=await AuctionLotModel.findById(id).session(session).exec();
    if(!lot)throw new AppError("Auction lot not found",404,"LOT_NOT_FOUND");
    const season=await SeasonModel.findById(lot.seasonRef).session(session).exec();
    if(!season||["completed","archived"].includes(season.status))throw new AppError("Season is closed",409,"SEASON_CLOSED");
    if(!season.auctionSettings)throw new AppError("Auction settings are unavailable for this season",409,"SEASON_RULES_UNAVAILABLE");

    const nextStatus=input.auctionStatus;
    const nextPosition=input.playerPosition??lot.playerPosition;
    const nextIcon=input.isIconPlayer??lot.isIconPlayer;
    lot.playerPosition=nextPosition;
    lot.isIconPlayer=nextIcon;
    lot.isGoalkeeper=nextPosition==="goalkeeper";

    if(nextStatus==="sold"){
     const seasonTeamId=input.seasonTeamId??(lot.auctionStatus==="sold"&&lot.seasonTeamRef?String(lot.seasonTeamRef):null);
     const purchasePrice=input.purchasePrice!==undefined?input.purchasePrice:lot.auctionStatus==="sold"?lot.purchasePrice:null;
     if(!seasonTeamId||purchasePrice===null||purchasePrice===undefined)throw new AppError("A sold lot requires a season team and purchase price",422,"SALE_DETAILS_REQUIRED");
     if(!Number.isFinite(purchasePrice)||purchasePrice<0)throw new AppError("Purchase price cannot be negative",422,"INVALID_PRICE");

     const team=await SeasonTeamModel.findById(seasonTeamId).session(session).exec();
     if(!team||String(team.seasonRef)!==String(lot.seasonRef)||["withdrawn","eliminated","completed"].includes(team.status)){
      throw new AppError("Select an eligible team registered in this season",422,"INVALID_SEASON_TEAM");
     }
     const jerseyNo=input.jerseyNo!==undefined?input.jerseyNo:lot.auctionStatus==="sold"&&String(lot.seasonTeamRef)===String(team._id)?lot.jerseyNo:null;
     if(jerseyNo!==null&&(!Number.isInteger(jerseyNo)||jerseyNo<1||jerseyNo>99))throw new AppError("Jersey number must be between 1 and 99",422,"INVALID_JERSEY");

     const otherSold={seasonTeamRef:team._id,auctionStatus:"sold",_id:{$ne:lot._id}};
     const [soldCount,spent,icons,goalkeepers,player,jerseyCount]=await Promise.all([
      AuctionLotModel.countDocuments(otherSold).session(session),
      AuctionLotModel.aggregate([{$match:otherSold},{$group:{_id:null,total:{$sum:"$purchasePrice"}}}]).session(session),
      AuctionLotModel.countDocuments({...otherSold,isIconPlayer:true}).session(session),
      AuctionLotModel.countDocuments({...otherSold,playerPosition:"goalkeeper"}).session(session),
      PlayerModel.findById(lot.playerRef).session(session).lean().exec(),
      jerseyNo===null?Promise.resolve(0):AuctionLotModel.countDocuments({...otherSold,jerseyNo}).session(session)
     ]);
     if(!player||player.status!=="active")throw new AppError("Player is no longer active",409,"PLAYER_UNAVAILABLE");
     const total=Number(spent[0]?.total??0);
     if(soldCount>=season.auctionSettings.teamSquadSize)throw new AppError("Team squad size limit reached",422,"SQUAD_LIMIT");
     if(total+purchasePrice>season.auctionSettings.budgetPerTeam)throw new AppError("Sale exceeds the team's remaining budget",422,"AUCTION_BUDGET_EXCEEDED");
     if(nextIcon&&icons>=season.auctionSettings.iconPlayerLimit)throw new AppError("Team Icon Player limit reached",422,"ICON_LIMIT");
     if(nextPosition==="goalkeeper"&&goalkeepers>=season.auctionSettings.goalkeeperLimit)throw new AppError("Team Goalkeeper limit reached",422,"GOALKEEPER_LIMIT");
     if(jerseyCount)throw new AppError("Jersey number already exists in this season team",409,"DUPLICATE_JERSEY");

     lot.seasonTeamRef=team._id;
     lot.purchasePrice=purchasePrice;
     lot.jerseyNo=jerseyNo;
     lot.soldAt=lot.auctionStatus==="sold"&&lot.soldAt?lot.soldAt:new Date();
    }else{
     lot.seasonTeamRef=null;
     lot.purchasePrice=null;
     lot.jerseyNo=null;
     lot.soldAt=null;
    }
    lot.auctionStatus=nextStatus;
    await SeasonModel.updateOne({_id:season._id},{$inc:{auctionRevision:1}},{session}).exec();
    await lot.save({session});
    saved=lot.toObject() as AuctionLotEntity;
   });
  }finally{
   await session.endSession();
  }
  if(!saved)throw new AppError("Auction lot update failed",500,"AUCTION_LOT_UPDATE_FAILED");
  const populated=await this.lots.findPopulatedById(String(saved._id));
  return this.map(populated??saved);
 }
 private map(l:AuctionLotEntity):AuctionLotResponseDto{
  const player=l.playerRef as unknown as {_id?:Types.ObjectId;name?:string;profilePic?:unknown}|Types.ObjectId;
  const seasonTeam=l.seasonTeamRef as unknown as {_id?:Types.ObjectId;displayName?:string;teamRef?:{_id:Types.ObjectId;name:string;shortName:string|null;logo:unknown}|Types.ObjectId}|Types.ObjectId|null;
  const teamData=seasonTeam&&!(seasonTeam instanceof Types.ObjectId)&&seasonTeam.displayName?{_id:String(seasonTeam._id),displayName:seasonTeam.displayName,team:seasonTeam.teamRef&&!(seasonTeam.teamRef instanceof Types.ObjectId)?{_id:String(seasonTeam.teamRef._id),name:seasonTeam.teamRef.name,shortName:seasonTeam.teamRef.shortName,logo:seasonTeam.teamRef.logo}:null}:null;
  const playerData=player instanceof Types.ObjectId?String(player):player.name?{_id:String(player._id),name:player.name,profilePic:player.profilePic}:String(player._id);
  return {_id:String(l._id),seasonRef:String(l.seasonRef),seasonTeamRef:teamData??(seasonTeam?this.refId(seasonTeam):null),playerRef:playerData,lotNumber:l.lotNumber,auctionStatus:l.auctionStatus,purchasePrice:l.purchasePrice,playerPosition:l.playerPosition,isIconPlayer:l.isIconPlayer,isGoalkeeper:l.playerPosition==="goalkeeper",jerseyNo:l.jerseyNo,nominatedAt:l.nominatedAt?.toISOString()??null,soldAt:l.soldAt?.toISOString()??null};
 }
 private refId(value:unknown):string{const v=value as {_id?:unknown};return String(v&&typeof v==="object"&&v._id?v._id:value);}

 private id(id:string){if(!Types.ObjectId.isValid(id))throw new AppError("Invalid ID",400,"INVALID_ID");}
}
