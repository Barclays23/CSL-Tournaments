import mongoose,{Types,type QueryFilter} from "mongoose";
import {AppError} from "../../shared/errors/appError.js";
import {SeasonModel} from "../seasons/season.model.js";
import {SeasonTeamModel} from "../seasonTeams/seasonTeam.model.js";
import {PlayerModel} from "../players/player.model.js";
import {SeasonMatchModel} from "../matches/seasonMatch.model.js";
import type {IAuctionLotService} from "./auctionLot.interfaces.js";
import {AuctionLotModel} from "./auctionLot.model.js";
import {AuctionLotRepository} from "./auctionLot.repository.js";
import type {NominatePlayerDto,SellAuctionLotDto,UpdateAuctionLotStatusDto,UpdateAuctionLotDto,AuctionLotResponseDto,AuctionSummaryDto,AuctionTeamSummaryDto,AuctionLotsQueryDto} from "./auctionLot.dto.js";
import type {AuctionLotEntity,AuctionLotFields,PopulatedAuctionLotEntity,PopulatedAuctionLotTeam} from "./auctionLot.types.js";
export class AuctionLotService implements IAuctionLotService{
 constructor(private readonly lots:AuctionLotRepository){}
 async summary(seasonId:string):Promise<AuctionSummaryDto>{
  this.id(seasonId);const season=await SeasonModel.findById(seasonId).lean().exec();if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  if(!season.auctionSettings)throw new AppError("Auction settings are unavailable for this historical season",409,"SEASON_RULES_UNAVAILABLE");
  const auctionSettings=season.auctionSettings;
  const [teams,lots]=await Promise.all([SeasonTeamModel.find({seasonRef:season._id}).populate({path:"teamRef",select:"name logo"}).lean<Array<Omit<import("../seasonTeams/seasonTeam.types.js").SeasonTeamEntity,"teamRef"> & {teamRef:Types.ObjectId|PopulatedAuctionLotTeam}>>().exec(),this.lots.find({seasonRef:new Types.ObjectId(seasonId)})]);
  const summaries:AuctionTeamSummaryDto[]=teams.map(st=>{const teamLots=lots.filter(l=>l.seasonTeamRef&&this.refId(l.seasonTeamRef)===String(st._id)&&(l.auctionStatus==="sold"||l.auctionStatus==="withdrawn"));const activeTeamLots=teamLots.filter(l=>l.auctionStatus==="sold");const spent=activeTeamLots.reduce((sum,l)=>sum+(l.purchasePrice??0),0);return {seasonTeamId:String(st._id),teamId:this.refId(st.teamRef),displayName:st.teamRef&&!(st.teamRef instanceof Types.ObjectId)?st.teamRef.name:st.displayName,logoSnapshot:st.teamRef&&!(st.teamRef instanceof Types.ObjectId)?st.teamRef.logo:st.logoSnapshot,status:st.status,budget:auctionSettings.budgetPerTeam,playersSigned:activeTeamLots.length,remainingSlots:auctionSettings.teamSquadSize-activeTeamLots.length,totalSpent:spent,balance:auctionSettings.budgetPerTeam-spent,averagePrice:activeTeamLots.length?spent/activeTeamLots.length:0,iconCount:activeTeamLots.filter(l=>l.isIconPlayer).length,goalkeeperCount:activeTeamLots.filter(l=>l.isGoalkeeper).length,lots:teamLots.map(l=>this.map(l))};});
  return {season:{_id:String(season._id),name:season.name,year:season.year,status:season.status,auctionSettings:season.auctionSettings,auctionLifecycleStatus:season.auctionLifecycleStatus},totals:{participatingTeams:teams.length,lots:lots.length,sold:lots.filter(l=>l.auctionStatus==="sold").length,pending:lots.filter(l=>l.auctionStatus==="pending").length,unsold:lots.filter(l=>l.auctionStatus==="unsold").length,withdrawn:lots.filter(l=>l.auctionStatus==="withdrawn").length,totalSoldValue:lots.filter(l=>l.auctionStatus==="sold").reduce((s,l)=>s+(l.purchasePrice??0),0)},teams:summaries,lots:lots.map(l=>this.map(l))};
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
    if(!season||!["upcoming","active"].includes(season.status)||!["not_started","in_progress"].includes(season.auctionLifecycleStatus))throw new AppError("Auction nominations are available only before or during an Upcoming or Active season auction",409,"SEASON_NOT_AUCTION_READY");
    if(!season.auctionSettings)throw new AppError("Auction settings are unavailable for this season",409,"SEASON_RULES_UNAVAILABLE");
    const lock=await SeasonModel.updateOne({_id:season._id,status:{$in:["upcoming","active"]},auctionLifecycleStatus:{$in:["not_started","in_progress"]}},{$inc:{auctionRevision:1}},{session}).exec();
    if(lock.matchedCount!==1)throw new AppError("Season is not open for nominations",409,"SEASON_CLOSED");
    // Write the Player master document in the same transaction as the new reference.
    // This serializes nomination against safe hard deletion of an otherwise unreferenced player.
    const playerLock=await PlayerModel.collection.updateOne(
     {_id:new Types.ObjectId(input.playerId),status:"active"},
     {$inc:{__v:1}},
     {session},
    );
    if(playerLock.modifiedCount!==1)throw new AppError("Active player not found",404,"PLAYER_NOT_FOUND");
    const count=await AuctionLotModel.countDocuments({seasonRef:new Types.ObjectId(input.seasonId),auctionStatus:{$ne:"withdrawn"}}).session(session).exec();
    if(count>=season.auctionSettings.playersCount)throw new AppError("Season player nomination limit reached",422,"AUCTION_PLAYER_LIMIT");
    created=await this.lots.create({seasonRef:new Types.ObjectId(input.seasonId),seasonTeamRef:null,playerRef:new Types.ObjectId(input.playerId),lotNumber:null,auctionStatus:"pending",purchasePrice:null,playerPosition:input.playerPosition,isIconPlayer:!!input.isIconPlayer,isGoalkeeper:!!input.isGoalkeeper,jerseyNo:null,nominatedAt:new Date(),soldAt:null},session);
   });
  }catch(error){
   if((error as {code?:number}).code===11000)throw new AppError("This player is already nominated in this season",409,"DUPLICATE_SEASON_PLAYER");
   throw error;
  }finally{await session.endSession();}
  const createdLot = created as AuctionLotEntity | null;
  if(!createdLot)throw new AppError("Player nomination failed",500,"AUCTION_NOMINATION_FAILED");
  const populated=await this.lots.findPopulatedById(String(createdLot._id));
  return this.map(populated??createdLot);
 }
 async sell(id:string,input:SellAuctionLotDto):Promise<AuctionLotResponseDto>{
  this.id(id);this.id(input.seasonTeamId);if(input.purchasePrice<0)throw new AppError("Purchase price cannot be negative",422,"INVALID_PRICE");
  const session=await mongoose.startSession();let saved:AuctionLotEntity|null=null;
  try{await session.withTransaction(async()=>{
   const lot=await AuctionLotModel.findById(id).session(session).exec();if(!lot||lot.auctionStatus!=="pending")throw new AppError("Only pending lots can be sold",409,"LOT_NOT_PENDING");
   const season=await SeasonModel.findById(lot.seasonRef).session(session).exec();const team=await SeasonTeamModel.findById(input.seasonTeamId).session(session).exec();
   if(!season||!["upcoming","active"].includes(season.status)||season.auctionLifecycleStatus !== "in_progress")throw new AppError("Auction sales are available only while an Upcoming or Active season auction is open",409,"SEASON_NOT_AUCTION_READY");
   if(!season||!team||String(team.seasonRef)!==String(lot.seasonRef)||["withdrawn","eliminated","completed"].includes(team.status))throw new AppError("Winning team must participate in the same season",422,"INVALID_SEASON_TEAM");
   if(!season.auctionSettings)throw new AppError("Auction settings are unavailable for this season",409,"SEASON_RULES_UNAVAILABLE");
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
   await SeasonModel.updateOne({_id:season._id},{$inc:{auctionRevision:1}},{session});
   lot.seasonTeamRef=team._id;lot.purchasePrice=input.purchasePrice;lot.jerseyNo=input.jerseyNo??null;lot.auctionStatus="sold";lot.soldAt=new Date();await lot.save({session});saved=lot.toObject() as unknown as AuctionLotEntity;
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
    if(!season||!["upcoming","active"].includes(season.status)||season.auctionLifecycleStatus !== "in_progress")throw new AppError("Auction lots can only be changed while an Upcoming or Active season auction is open",409,"SEASON_NOT_AUCTION_READY");
    if(!season.auctionSettings)throw new AppError("Auction settings are unavailable for this season",409,"SEASON_RULES_UNAVAILABLE");

    const previousStatus = lot.auctionStatus;
    const nextStatus=input.auctionStatus;
    if (lot.auctionStatus === "withdrawn") throw new AppError("Withdrawn auction lots are historical records and cannot be changed again.", 409, "LOT_WITHDRAWN_READ_ONLY");
    if (nextStatus === "withdrawn" && lot.auctionStatus !== "sold") throw new AppError("Only a Sold player can be marked Withdrawn.", 409, "LOT_WITHDRAWAL_NOT_ALLOWED");
    if (lot.auctionStatus === "sold" && (nextStatus === "pending" || nextStatus === "unsold")) {
      const teamId = lot.seasonTeamRef ? String(lot.seasonTeamRef) : "";
      const fixtureCount = teamId ? await SeasonMatchModel.countDocuments({
        seasonRef: lot.seasonRef,
        $or: [{ homeSeasonTeamRef: new Types.ObjectId(teamId) }, { awaySeasonTeamRef: new Types.ObjectId(teamId) }],
      }).session(session).exec() : 0;
      if (fixtureCount > 0) throw new AppError("A Sold player cannot be reset to Pending or Unsold after the team has fixtures. Mark the player Withdrawn to preserve history.", 409, "LOT_HAS_FIXTURES");
    }
    const nextPosition=input.playerPosition??lot.playerPosition;
    const nextIcon=input.isIconPlayer??lot.isIconPlayer;
    const nextGoalkeeper=input.isGoalkeeper??lot.isGoalkeeper;
    lot.playerPosition=nextPosition;
    lot.isIconPlayer=nextIcon;
    lot.isGoalkeeper=nextGoalkeeper;

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

     const otherSold:QueryFilter<AuctionLotFields>={seasonTeamRef:team._id,auctionStatus:"sold",_id:{$ne:lot._id}};
     const [soldCount,spent,icons,goalkeepers,player,jerseyCount]=await Promise.all([
      AuctionLotModel.countDocuments(otherSold).session(session),
      AuctionLotModel.aggregate([{$match:otherSold},{$group:{_id:null,total:{$sum:"$purchasePrice"}}}]).session(session),
      AuctionLotModel.countDocuments({...otherSold,isIconPlayer:true}).session(session),
      AuctionLotModel.countDocuments({...otherSold,isGoalkeeper:true}).session(session),
      PlayerModel.findById(lot.playerRef).session(session).lean().exec(),
      jerseyNo===null?Promise.resolve(0):AuctionLotModel.countDocuments({...otherSold,jerseyNo}).session(session)
     ]);
     if(!player||player.status!=="active")throw new AppError("Player is no longer active",409,"PLAYER_UNAVAILABLE");
     const total=Number(spent[0]?.total??0);
     if(soldCount>=season.auctionSettings.teamSquadSize)throw new AppError("Team squad size limit reached",422,"SQUAD_LIMIT");
     if(total+purchasePrice>season.auctionSettings.budgetPerTeam)throw new AppError("Sale exceeds the team's remaining budget",422,"AUCTION_BUDGET_EXCEEDED");
     if(nextIcon&&icons>=season.auctionSettings.iconPlayerLimit)throw new AppError("Team Icon Player limit reached",422,"ICON_LIMIT");
     if(nextGoalkeeper&&goalkeepers>=season.auctionSettings.goalkeeperLimit)throw new AppError("Team Goalkeeper limit reached",422,"GOALKEEPER_LIMIT");
     if(jerseyCount)throw new AppError("Jersey number already exists in this season team",409,"DUPLICATE_JERSEY");

     lot.seasonTeamRef=team._id;
     lot.purchasePrice=purchasePrice;
     lot.jerseyNo=jerseyNo;
     lot.soldAt=lot.auctionStatus==="sold"&&lot.soldAt?lot.soldAt:new Date();
    }else if (nextStatus !== "withdrawn") {
     lot.seasonTeamRef=null;
     lot.purchasePrice=null;
     lot.jerseyNo=null;
     lot.soldAt=null;
    }
    lot.auctionStatus=nextStatus;
    if (nextStatus === "withdrawn" && previousStatus === "sold") {
     await SeasonModel.updateOne({ _id: season._id }, { $set: { auctionLifecycleStatus: "in_progress" }, $inc: { auctionRevision: 1 } }, { session }).exec();
    }
    await SeasonModel.updateOne({_id:season._id},{$inc:{auctionRevision:1}},{session}).exec();
    await lot.save({session});
    saved=lot.toObject() as unknown as AuctionLotEntity;
   });
  }finally{
   await session.endSession();
  }
  const savedLot = saved as AuctionLotEntity | null;
  if(!savedLot)throw new AppError("Auction lot update failed",500,"AUCTION_LOT_UPDATE_FAILED");
  const populated=await this.lots.findPopulatedById(String(savedLot._id));
  return this.map(populated??savedLot);
 }
 async deletePending(id:string):Promise<void>{
  this.id(id);
  const session=await mongoose.startSession();
  try{
   await session.withTransaction(async()=>{
    const lot=await AuctionLotModel.findById(id).session(session).exec();
    if(!lot)throw new AppError("Auction lot not found",404,"LOT_NOT_FOUND");
    if(lot.auctionStatus!=="pending")throw new AppError("Only pending auction lots can be removed. Sold, Unsold and Withdrawn lots are retained as auction history.",409,"LOT_DELETE_NOT_ALLOWED");
    if(lot.seasonTeamRef)throw new AppError("This auction lot is assigned to a season team and cannot be removed.",409,"LOT_ALREADY_ASSIGNED");
    const season=await SeasonModel.findById(lot.seasonRef).session(session).exec();
    if(!season||!["upcoming","active"].includes(season.status)||season.auctionLifecycleStatus!=="in_progress")throw new AppError("Pending lots can only be removed while the auction is in progress.",409,"SEASON_NOT_AUCTION_READY");
    const lock=await SeasonModel.updateOne(
     {_id:season._id,status:{$in:["upcoming","active"]},auctionLifecycleStatus:"in_progress"},
     {$inc:{auctionRevision:1}},
     {session},
    ).exec();
    if(lock.matchedCount!==1)throw new AppError("Season auction state changed. Refresh and try again.",409,"SEASON_STATE_CONFLICT");
    const deleted=await AuctionLotModel.deleteOne({_id:lot._id,auctionStatus:"pending",seasonTeamRef:null}).session(session).exec();
    if(deleted.deletedCount!==1)throw new AppError("Auction lot changed before it could be removed. Refresh and try again.",409,"LOT_DELETE_CONFLICT");

   });
  }finally{await session.endSession();}
 }
 private map(l:AuctionLotEntity|PopulatedAuctionLotEntity):AuctionLotResponseDto{
  const player=l.playerRef;
  const populatedPlayer=player instanceof Types.ObjectId?null:player;
  const seasonTeam=l.seasonTeamRef;
  const populatedSeasonTeam=seasonTeam&&!(seasonTeam instanceof Types.ObjectId)?seasonTeam:null;
  const populatedTeam=populatedSeasonTeam?.teamRef&&!(populatedSeasonTeam.teamRef instanceof Types.ObjectId)?populatedSeasonTeam.teamRef:null;
  const teamData=populatedSeasonTeam?{
   _id:String(populatedSeasonTeam._id),
   displayName:populatedTeam?.name??populatedSeasonTeam.displayName,
   team:populatedTeam?{_id:String(populatedTeam._id),name:populatedTeam.name,shortName:populatedTeam.shortName,logo:populatedTeam.logo}:null,
  }:null;
  const playerData=populatedPlayer?{_id:String(populatedPlayer._id),name:populatedPlayer.name,profilePic:populatedPlayer.profilePic}:String(player);
  return {_id:String(l._id),seasonRef:String(l.seasonRef),seasonTeamRef:teamData??(seasonTeam?this.refId(seasonTeam):null),playerRef:playerData,lotNumber:l.lotNumber,auctionStatus:l.auctionStatus,purchasePrice:l.purchasePrice,playerPosition:l.playerPosition,isIconPlayer:l.isIconPlayer,isGoalkeeper:l.isGoalkeeper,jerseyNo:l.jerseyNo,nominatedAt:l.nominatedAt?.toISOString()??null,soldAt:l.soldAt?.toISOString()??null};
 }
 private refId(value:unknown):string{const v=value as {_id?:unknown};return String(v&&typeof v==="object"&&v._id?v._id:value);}

 private id(id:string){if(!Types.ObjectId.isValid(id))throw new AppError("Invalid ID",400,"INVALID_ID");}
}
