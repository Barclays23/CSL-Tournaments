import {Types} from "mongoose";
import type {ManagerEntity} from "../managers/manager.types.js";
import {SeasonModel} from "../seasons/season.model.js";
import {SeasonTeamModel} from "../seasonTeams/seasonTeam.model.js";
import {GroupModel} from "../groups/group.model.js";
import {AuctionLotModel} from "../auctionLots/auctionLot.model.js";
import {PlayerModel} from "../players/player.model.js";
import {TeamModel} from "../teams/team.model.js";
import {SeasonMatchModel} from "../matches/seasonMatch.model.js";
import type {SeasonEntity} from "../seasons/season.types.js";
import type {SeasonTeamEntity} from "../seasonTeams/seasonTeam.types.js";
import type {AuctionLotEntity} from "../auctionLots/auctionLot.types.js";
import type {PlayerEntity} from "../players/player.types.js";
import type {TeamEntity} from "../teams/team.types.js";
import type {PopulatedSeasonMatch} from "../matches/seasonMatch.types.js";
const teamPopulation=[{path:"teamRef",select:"name shortName logo status"},{path:"groupRef",select:"groupName displayOrder"},{path:"managerRefs",select:"name role profilePic status"}];
const matchPopulation=[
 {path:"homeSeasonTeamRef",select:"displayName logoSnapshot teamRef",populate:{path:"teamRef",select:"name shortName logo"}},
 {path:"awaySeasonTeamRef",select:"displayName logoSnapshot teamRef",populate:{path:"teamRef",select:"name shortName logo"}},
 {path:"winnerSeasonTeamRef",select:"displayName logoSnapshot teamRef",populate:{path:"teamRef",select:"name shortName logo"}},
 {path:"goals.scoringSeasonTeamRef",select:"displayName logoSnapshot teamRef",populate:{path:"teamRef",select:"name shortName logo"}},
 {path:"goals.playerSeasonTeamRef",select:"displayName logoSnapshot teamRef",populate:{path:"teamRef",select:"name shortName logo"}},
 {path:"goals.scorerPlayerRef",select:"name profilePic"}
];
export type PopulatedSeasonManager=Pick<ManagerEntity,"_id"|"name"|"role"|"profilePic">;
export type PopulatedSeasonTeam=Omit<SeasonTeamEntity,"managerRefs">&{managerRefs:Array<PopulatedSeasonManager|Types.ObjectId>};
export type PopulatedAuctionLot=Omit<AuctionLotEntity,"playerRef"|"seasonTeamRef"|"seasonRef">&{playerRef:PlayerEntity;seasonTeamRef:any;seasonRef:SeasonEntity};
export class SeasonStatisticsRepository{
 async findSeason(id:string):Promise<SeasonEntity|null>{return SeasonModel.findById(id).lean<SeasonEntity>().exec();}
 async findActiveSeason():Promise<SeasonEntity|null>{return SeasonModel.findOne({status:"active"}).lean<SeasonEntity>().exec();}
 async findSeasonTeams(id:string):Promise<PopulatedSeasonTeam[]>{return SeasonTeamModel.find({seasonRef:new Types.ObjectId(id),status:{$ne:"withdrawn"}}).sort({displayName:1}).populate(teamPopulation).lean<PopulatedSeasonTeam[]>().exec();}
 async findSeasonTeam(seasonId:string,teamId:string):Promise<PopulatedSeasonTeam|null>{return SeasonTeamModel.findOne({seasonRef:new Types.ObjectId(seasonId),teamRef:new Types.ObjectId(teamId)}).populate(teamPopulation).lean<PopulatedSeasonTeam>().exec();}
 async findGroups(id:string):Promise<any[]>{return GroupModel.find({seasonRef:new Types.ObjectId(id)}).sort({displayOrder:1,groupName:1}).lean().exec();}
 async findGroupStandingsMatches(id:string):Promise<PopulatedSeasonMatch[]>{return SeasonMatchModel.find({seasonRef:new Types.ObjectId(id),stage:"group",status:{$in:["completed","live"]}}).sort({kickoffAt:1}).populate(matchPopulation).lean<PopulatedSeasonMatch[]>().exec();}
 async findMatchesForTopScorers(id:string):Promise<PopulatedSeasonMatch[]>{return SeasonMatchModel.find({seasonRef:new Types.ObjectId(id),status:{$in:["completed","live"]}}).sort({kickoffAt:1}).populate(matchPopulation).lean<PopulatedSeasonMatch[]>().exec();}
 async findMatchesForSeasonTeam(id:string,teamId:string):Promise<PopulatedSeasonMatch[]>{const t=new Types.ObjectId(teamId);return SeasonMatchModel.find({seasonRef:new Types.ObjectId(id),$or:[{homeSeasonTeamRef:t},{awaySeasonTeamRef:t}],status:{$nin:["cancelled","abandoned"]}}).sort({kickoffAt:1}).populate(matchPopulation).lean<PopulatedSeasonMatch[]>().exec();}
 async findSquadLots(id:string):Promise<PopulatedAuctionLot[]>{return AuctionLotModel.find({seasonRef:new Types.ObjectId(id),auctionStatus:{$in:["sold","withdrawn"]}}).populate({path:"playerRef",select:"name profilePic"}).populate({path:"seasonRef"}).populate({path:"seasonTeamRef",populate:{path:"teamRef",select:"name shortName logo"}}).sort({soldAt:1}).lean<PopulatedAuctionLot[]>().exec();}
 async findSquadLots(id:string):Promise<PopulatedAuctionLot[]>{return AuctionLotModel.find({seasonRef:new Types.ObjectId(id),auctionStatus:{$in:["sold","withdrawn"]}}).populate({path:"playerRef",select:"name profilePic"}).populate({path:"seasonRef"}).populate({path:"seasonTeamRef",populate:{path:"teamRef",select:"name shortName logo"}}).sort({soldAt:1}).lean<PopulatedAuctionLot[]>().exec();}
 async findSoldLots(id:string):Promise<PopulatedAuctionLot[]>{return AuctionLotModel.find({seasonRef:new Types.ObjectId(id),auctionStatus:"sold"}).populate({path:"playerRef",select:"name profilePic"}).populate({path:"seasonRef"}).populate({path:"seasonTeamRef",populate:{path:"teamRef",select:"name shortName logo"}}).sort({soldAt:1}).lean<PopulatedAuctionLot[]>().exec();}
 async findLotsForPlayer(id:string):Promise<PopulatedAuctionLot[]>{return AuctionLotModel.find({playerRef:new Types.ObjectId(id)}).populate({path:"playerRef",select:"name profilePic mobile email dateOfBirth status"}).populate({path:"seasonRef"}).populate({path:"seasonTeamRef",populate:{path:"teamRef",select:"name shortName logo"}}).sort({createdAt:1}).lean<PopulatedAuctionLot[]>().exec();}
 async findPlayer(id:string):Promise<PlayerEntity|null>{return PlayerModel.findById(id).lean<PlayerEntity>().exec();}
 async findTeam(id:string):Promise<TeamEntity|null>{return TeamModel.findById(id).lean<TeamEntity>().exec();}
 async findPlayersByIds(ids:string[]):Promise<PlayerEntity[]>{if(!ids.length)return [];return PlayerModel.find({_id:{$in:ids.map(x=>new Types.ObjectId(x))}}).lean<PlayerEntity[]>().exec();}
 async findCompletedMatchesForPlayer(id:string):Promise<PopulatedSeasonMatch[]>{const seasonIds=await AuctionLotModel.distinct("seasonRef",{playerRef:new Types.ObjectId(id),auctionStatus:"sold"}).exec();if(!seasonIds.length)return [];return SeasonMatchModel.find({seasonRef:{$in:seasonIds},status:"completed","goals.scorerPlayerRef":new Types.ObjectId(id)}).populate(matchPopulation).populate({path:"seasonRef"}).lean<PopulatedSeasonMatch[]>().exec();}
}
