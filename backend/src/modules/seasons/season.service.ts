import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import type { ITeamRepository } from "../teams/team.interfaces.js";
import { SeasonTeamRepository } from "../seasonTeams/seasonTeam.repository.js";
import type { SeasonTeamEntity } from "../seasonTeams/seasonTeam.types.js";
import type { ISeasonRepository,ISeasonService } from "./season.interfaces.js";
import type { CreateSeasonDto,UpdateSeasonDto,SeasonQueryDto,SeasonResponseDto,RegisterSeasonTeamsDto } from "./season.dto.js";
import type { SeasonEntity,SeasonFields } from "./season.types.js";

export class SeasonService implements ISeasonService{
 constructor(private readonly repo:ISeasonRepository,private readonly teams:ITeamRepository,private readonly seasonTeams:SeasonTeamRepository){}
 async list(query:SeasonQueryDto):Promise<SeasonResponseDto[]>{return (await this.repo.findSeasons(query)).map(s=>this.map(s));}
 async get(id:string):Promise<SeasonResponseDto>{this.ensureId(id);const s=await this.repo.findById(id);if(!s)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");return this.map(s);}
 async create(input:CreateSeasonDto):Promise<SeasonResponseDto>{
  if(await this.repo.findByNumber(input.seasonNumber))throw new AppError("Season number already exists",409,"DUPLICATE_SEASON");
  if(input.status==="active"&&await this.repo.findActive())throw new AppError("Another season is already active",409,"ACTIVE_SEASON_EXISTS");
  if(input.teamIds.length>input.auctionSettings.seasonTeamCount)throw new AppError("Selected teams exceed the season team limit",422,"SEASON_TEAM_LIMIT");
  const records=await Promise.all(input.teamIds.map(async id=>{const t=await this.teams.findTeamById(id);if(!t||t.status!=="active")throw new AppError("All selected teams must be active",422,"INVALID_SEASON_TEAM");return {_id:t._id,name:t.name,logo:t.logo};}));
  return this.map(await this.repo.createWithTeams(input,records));
 }
 async update(id:string,input:UpdateSeasonDto):Promise<SeasonResponseDto>{
  this.ensureId(id);const current=await this.repo.findById(id);if(!current)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  if(input.status==="active"&&await this.repo.findActive(id))throw new AppError("Another season is already active",409,"ACTIVE_SEASON_EXISTS");
  const lotCount=await this.repo.countLots(id);
  if(lotCount>0&&input.auctionSettings&&JSON.stringify(input.auctionSettings)!==JSON.stringify(current.auctionSettings))throw new AppError("Auction settings cannot be changed after player nominations; preserve historical auction rules",409,"SEASON_AUCTION_LOCKED");
  if(input.auctionSettings&&input.auctionSettings.seasonTeamCount<await this.seasonTeams.countBySeason(id))throw new AppError("Team limit cannot be lower than the number of registered teams",409,"SEASON_TEAM_LIMIT_LOCKED");
  const updated=await this.repo.update(id,input as Partial<SeasonFields>);if(!updated)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");return this.map(updated);
 }
 async registerTeams(id:string,input:RegisterSeasonTeamsDto):Promise<SeasonTeamEntity[]>{
  this.ensureId(id);const season=await this.repo.findById(id);if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  if(season.status==="completed"||season.status==="archived")throw new AppError("Teams cannot be registered in a completed or archived season",409,"SEASON_CLOSED");
  const existing=await this.seasonTeams.findBySeason(id);const known=new Set(existing.map(t=>String(t.teamRef)));
  const additions=input.teamIds.filter(teamId=>!known.has(teamId));
  if(additions.length!==input.teamIds.length)throw new AppError("One or more teams are already registered",409,"DUPLICATE_SEASON_TEAM");
  if(existing.length+additions.length>season.auctionSettings.seasonTeamCount)throw new AppError("Season team limit exceeded",422,"SEASON_TEAM_LIMIT");
  const records=await Promise.all(additions.map(async teamId=>{const team=await this.teams.findTeamById(teamId);if(!team||team.status!=="active")throw new AppError("Selected team is not active",422,"INVALID_SEASON_TEAM");return {seasonRef:new Types.ObjectId(id),teamRef:new Types.ObjectId(teamId),displayName:team.name,logoSnapshot:team.logo,groupRef:null,managerRefs:[],status:"registered" as const};}));
  try{return await this.repo.registerTeamsAtomically(id,records,season.auctionSettings.seasonTeamCount);}
  catch(error){
   if((error as {code?:number}).code===11000)throw new AppError("One or more teams are already registered in this season",409,"DUPLICATE_SEASON_TEAM");
   if(error instanceof Error&&error.message==="SEASON_TEAM_LIMIT")throw new AppError("Season team limit exceeded",422,"SEASON_TEAM_LIMIT");
   if(error instanceof Error&&error.message==="SEASON_CLOSED")throw new AppError("Teams cannot be registered in a completed or archived season",409,"SEASON_CLOSED");
   throw error;
  }
 }
 private map(s:SeasonEntity):SeasonResponseDto{return {...s,_id:String(s._id),startDate:s.startDate?.toISOString()??null,endDate:s.endDate?.toISOString()??null,createdAt:s.createdAt.toISOString(),updatedAt:s.updatedAt.toISOString()};}
 private ensureId(id:string){if(!Types.ObjectId.isValid(id))throw new AppError("Invalid season ID",400,"INVALID_ID");}
}
