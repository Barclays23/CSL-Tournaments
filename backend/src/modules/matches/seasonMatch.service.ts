import {Types} from "mongoose";
import {AppError} from "../../shared/errors/appError.js";
import type {PaginatedResult} from "../../shared/types/common.types.js";
import type {SeasonMatchRepository} from "./seasonMatch.repository.js";
import type {ISeasonMatchService} from "./seasonMatch.interfaces.js";
import type {CreateSeasonMatchDto,UpdateSeasonMatchDto,SeasonMatchQueryDto,SeasonGoalDto,SeasonMatchResponseDto,SeasonGoalResponseDto,SeasonMatchTeamDto,SeasonMatchPlayerDto} from "./seasonMatch.dto.js";
import type {SeasonMatchFields,SeasonMatchEntity,PopulatedSeasonMatch,PopulatedSeasonGoal} from "./seasonMatch.types.js";

export class SeasonMatchService implements ISeasonMatchService{
 constructor(private readonly repo:SeasonMatchRepository){}
 async list(seasonId:string,query:SeasonMatchQueryDto):Promise<PaginatedResult<SeasonMatchResponseDto>>{
  this.id(seasonId,"season");
  const filter:import("./seasonMatch.types.js").SeasonMatchListFilter={seasonRef:new Types.ObjectId(seasonId)};
  if(query.stage)filter.stage=query.stage;
  if(query.groupRef!==undefined)filter.groupRef=query.groupRef?new Types.ObjectId(query.groupRef):null;
  if(query.status)filter.status=query.status;
  if(query.dateFrom||query.dateTo)filter.kickoffAt={...(query.dateFrom?{$gte:query.dateFrom}:{}),...(query.dateTo?{$lte:query.dateTo}:{})};

  const clauses:Array<{ $or:Array<Partial<import("./seasonMatch.types.js").SeasonMatchListFilter>> }>=[];
  if(query.seasonTeamRef){
   const teamId=new Types.ObjectId(query.seasonTeamRef);
   clauses.push({$or:[{homeSeasonTeamRef:teamId},{awaySeasonTeamRef:teamId}]});
  }
  if(query.search){
   const search=query.search.trim();
   const conditions:Array<Partial<import("./seasonMatch.types.js").SeasonMatchListFilter>>=[];
   const numberMatch=search.match(/\d+/)?.[0];
   if(numberMatch)conditions.push({matchNumber:Number(numberMatch)});
   const matchingTeams=await this.repo.findSeasonTeamIdsByName(seasonId,search);
   if(matchingTeams.length)conditions.push({homeSeasonTeamRef:{$in:matchingTeams}},{awaySeasonTeamRef:{$in:matchingTeams}});
   if(!conditions.length)return {items:[],pagination:{page:query.page,limit:query.limit,total:0,totalPages:0}};
   clauses.push({$or:conditions});
  }
  if(clauses.length===1)filter.$or=clauses[0].$or;
  else if(clauses.length>1)filter.$and=clauses;

  const result=await this.repo.find(filter,query.page,query.limit);
  return {items:result.items.map(m=>this.map(m)),pagination:{page:query.page,limit:query.limit,total:result.total,totalPages:Math.ceil(result.total/query.limit)}};
 }
 async get(id:string):Promise<SeasonMatchResponseDto>{this.id(id,"match");const m=await this.repo.findPopulatedById(id);if(!m)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");return this.map(m);}
 async create(seasonId:string,input:CreateSeasonMatchDto):Promise<SeasonMatchResponseDto>{
  this.id(seasonId,"season");const season=await this.repo.findSeason(seasonId);if(!season||!["upcoming","active"].includes(season.status))throw new AppError("Fixtures can only be created for Upcoming or Active seasons",409,"SEASON_NOT_FIXTURE_READY");
  if(!season.matchRules)throw new AppError("Match rules are unavailable for this historical season",409,"SEASON_RULES_UNAVAILABLE");
  if(input.stage==="group"&&!season.groupStageEnabled)throw new AppError("Group-stage fixtures are disabled for this season",409,"GROUP_STAGE_DISABLED");
  this.assertKickoffWithinSeason(season,input.kickoffAt);
  if(await this.repo.findByNumber(seasonId,input.matchNumber))throw new AppError("Match number already exists in this season",409,"DUPLICATE_MATCH_NUMBER");
  const homeId=input.homeSeasonTeamRef,awayId=input.awaySeasonTeamRef;
  await this.validateSeasonTeams(seasonId,homeId,awayId,input.stage,input.groupRef??null);
  const fields:SeasonMatchFields={seasonRef:new Types.ObjectId(seasonId),matchNumber:input.matchNumber,stage:input.stage,groupRef:input.stage==="group"&&input.groupRef?new Types.ObjectId(input.groupRef):null,kickoffAt:input.kickoffAt,venue:input.venue??null,homeSeasonTeamRef:new Types.ObjectId(homeId),awaySeasonTeamRef:new Types.ObjectId(awayId),status:input.status??"scheduled",goals:[],penaltyShootout:null,winnerSeasonTeamRef:null,notes:input.notes??null};
  if(fields.status==="completed")throw new AppError("Create fixtures as scheduled, record goals, then complete the match",422,"INVALID_MATCH_COMPLETION");
  const created=await this.repo.create(fields);const populated=await this.repo.findPopulatedById(String(created._id));if(!populated)throw new AppError("Created fixture could not be retrieved",500,"MATCH_CREATE_FAILED");return this.map(populated);
 }
 async update(id:string,input:UpdateSeasonMatchDto):Promise<SeasonMatchResponseDto>{
  this.id(id,"match");const existing=await this.repo.findById(id);if(!existing)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");
  const season=await this.repo.findSeason(String(existing.seasonRef));if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  if(["completed","archived"].includes(season.status))throw new AppError("Completed or archived season matches are read-only",409,"SEASON_CLOSED");
  const homeId=input.homeSeasonTeamRef??String(existing.homeSeasonTeamRef),awayId=input.awaySeasonTeamRef??String(existing.awaySeasonTeamRef);
  const stage=input.stage??existing.stage,groupId=input.groupRef===undefined?(existing.groupRef?String(existing.groupRef):null):input.groupRef;
  await this.validateSeasonTeams(String(existing.seasonRef),homeId,awayId,stage,groupId);
  const kickoffAt=input.kickoffAt??existing.kickoffAt;
  this.assertKickoffWithinSeason(season,kickoffAt);
  if(stage==="group"&&!season.groupStageEnabled)throw new AppError("Group-stage fixtures are disabled for this season",409,"GROUP_STAGE_DISABLED");
  if((homeId!==String(existing.homeSeasonTeamRef)||awayId!==String(existing.awaySeasonTeamRef))&&existing.goals.length)throw new AppError("Remove or reassign goal events before changing the participating teams",409,"MATCH_HAS_GOALS");
  const number=input.matchNumber??existing.matchNumber;
  if(number!==existing.matchNumber){const duplicate=await this.repo.findByNumber(String(existing.seasonRef),number);if(duplicate&&String(duplicate._id)!==id)throw new AppError("Match number already exists in this season",409,"DUPLICATE_MATCH_NUMBER");}
  const merged:SeasonMatchFields={...existing,matchNumber:number,stage,groupRef:stage==="group"&&groupId?new Types.ObjectId(groupId):null,kickoffAt,venue:input.venue===undefined?existing.venue:input.venue,homeSeasonTeamRef:new Types.ObjectId(homeId),awaySeasonTeamRef:new Types.ObjectId(awayId),status:input.status??existing.status,penaltyShootout:input.penaltyShootout===undefined?existing.penaltyShootout:this.buildShootout(input.penaltyShootout),notes:input.notes===undefined?existing.notes:input.notes,winnerSeasonTeamRef:existing.winnerSeasonTeamRef};
  if(merged.penaltyShootout)await this.validateShootout(String(existing.seasonRef),merged,merged.penaltyShootout);
  merged.winnerSeasonTeamRef=this.calculateWinner(merged,season.matchRules);
  const saved=await this.repo.update(id,{matchNumber:merged.matchNumber,stage:merged.stage,groupRef:merged.groupRef,kickoffAt:merged.kickoffAt,venue:merged.venue,homeSeasonTeamRef:merged.homeSeasonTeamRef,awaySeasonTeamRef:merged.awaySeasonTeamRef,status:merged.status,penaltyShootout:merged.penaltyShootout,winnerSeasonTeamRef:merged.winnerSeasonTeamRef,notes:merged.notes});
  if(!saved)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");const populated=await this.repo.findPopulatedById(id);if(!populated)throw new AppError("Updated fixture could not be retrieved",500,"MATCH_UPDATE_FAILED");return this.map(populated);
 }
 async delete(id:string):Promise<void>{this.id(id,"match");const existing=await this.repo.findById(id);if(!existing)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");throw new AppError("Fixtures are retained as tournament history and cannot be physically deleted. Change the fixture status to cancelled or abandoned instead.",409,"MATCH_DELETE_BLOCKED");}
 async addGoal(id:string,input:SeasonGoalDto):Promise<SeasonMatchResponseDto>{const match=await this.getExisting(id);const goal=await this.buildGoal(match,input);const result={...match,goals:[...match.goals,goal]};const season=await this.repo.findSeason(String(match.seasonRef));if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");if(!season.matchRules)throw new AppError("Match rules are unavailable for this season",409,"SEASON_RULES_UNAVAILABLE");const winner=this.calculateWinner({...match,goals:result.goals},season.matchRules);const saved=await this.repo.appendGoal(id,goal);if(!saved)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");await this.repo.update(id,{winnerSeasonTeamRef:winner});const populated=await this.repo.findPopulatedById(id);if(!populated)throw new AppError("Updated match could not be retrieved",500,"MATCH_UPDATE_FAILED");return this.map(populated);}
 async updateGoal(id:string,goalId:string,input:SeasonGoalDto):Promise<SeasonMatchResponseDto>{const match=await this.getExisting(id);this.id(goalId,"goal");if(!match.goals.some(g=>String(g._id)===goalId))throw new AppError("Goal not found",404,"GOAL_NOT_FOUND");const goal=await this.buildGoal(match,input);const goals=match.goals.map(g=>String(g._id)===goalId?goal:g);const season=await this.repo.findSeason(String(match.seasonRef));if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");if(!season.matchRules)throw new AppError("Match rules are unavailable for this season",409,"SEASON_RULES_UNAVAILABLE");const winner=this.calculateWinner({...match,goals},season.matchRules);const saved=await this.repo.updateGoal(id,goalId,goal);if(!saved)throw new AppError("Goal not found",404,"GOAL_NOT_FOUND");await this.repo.update(id,{winnerSeasonTeamRef:winner});const populated=await this.repo.findPopulatedById(id);if(!populated)throw new AppError("Updated match could not be retrieved",500,"MATCH_UPDATE_FAILED");return this.map(populated);}
 async deleteGoal(id:string,goalId:string):Promise<SeasonMatchResponseDto>{const match=await this.getExisting(id);this.id(goalId,"goal");const goals=match.goals.filter(g=>String(g._id)!==goalId);if(goals.length===match.goals.length)throw new AppError("Goal not found",404,"GOAL_NOT_FOUND");const season=await this.repo.findSeason(String(match.seasonRef));if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");const winner=this.calculateWinner({...match,goals},season.matchRules);const saved=await this.repo.removeGoal(id,goalId);if(!saved)throw new AppError("Goal not found",404,"GOAL_NOT_FOUND");await this.repo.update(id,{winnerSeasonTeamRef:winner});const populated=await this.repo.findPopulatedById(id);if(!populated)throw new AppError("Updated match could not be retrieved",500,"MATCH_UPDATE_FAILED");return this.map(populated);}
 private assertKickoffWithinSeason(season:NonNullable<Awaited<ReturnType<SeasonMatchRepository["findSeason"]>>>,kickoffAt:Date):void{
  const day=new Intl.DateTimeFormat("en-CA",{timeZone:season.timeZone}).format(kickoffAt);
  const start=season.startDate?season.startDate.toISOString().slice(0,10):null;
  const end=season.endDate?season.endDate.toISOString().slice(0,10):null;
  if(start&&day<start)throw new AppError("Fixture date is before the season start date",422,"FIXTURE_BEFORE_SEASON",{kickoffAt:"Choose a fixture date on or after "+start});
  if(end&&day>end)throw new AppError("Fixture date is after the season end date",422,"FIXTURE_AFTER_SEASON",{kickoffAt:"Choose a fixture date on or before "+end});
 }
 private async getExisting(id:string):Promise<SeasonMatchEntity>{this.id(id,"match");const match=await this.repo.findById(id);if(!match)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");const season=await this.repo.findSeason(String(match.seasonRef));if(season&&["completed","archived"].includes(season.status))throw new AppError("Completed or archived season matches are read-only",409,"SEASON_CLOSED");return match;}
 private async validateSeasonTeams(seasonId:string,homeId:string,awayId:string,stage:SeasonMatchFields["stage"],groupId:string|null):Promise<void>{
  if(homeId===awayId)throw new AppError("A team cannot play itself",422,"SAME_TEAMS");
  const [home,away]=await Promise.all([this.repo.findSeasonTeam(seasonId,homeId),this.repo.findSeasonTeam(seasonId,awayId)]);
  if(!home||!away||["withdrawn","eliminated","completed"].includes(home.status)||["withdrawn","eliminated","completed"].includes(away.status))throw new AppError("Both teams must be participating in the selected season",422,"INVALID_SEASON_TEAMS");
  if(stage==="group"){
   if(!groupId)throw new AppError("Group is required for a group-stage fixture",422,"GROUP_REQUIRED");
   const group=await this.repo.findGroup(seasonId,groupId);if(!group)throw new AppError("Select a group from this season",422,"INVALID_GROUP");
   if(String(home.groupRef)!==groupId||String(away.groupRef)!==groupId)throw new AppError("Both teams must be assigned to the selected group",422,"GROUP_MISMATCH");
  }else if(groupId){throw new AppError("Knockout fixtures cannot belong to a group",422,"INVALID_GROUP_STAGE");}
 }
 private async buildGoal(match:SeasonMatchEntity,input:SeasonGoalDto):Promise<SeasonMatchFields["goals"][number]>{
  const home=String(match.homeSeasonTeamRef),away=String(match.awaySeasonTeamRef),scoring=input.scoringSeasonTeamRef;
  if(scoring!==home&&scoring!==away)throw new AppError("Credited team must be one of the match participants",422,"INVALID_SCORING_TEAM");
  if(input.goalType==="normal"){
   if(!input.scorerPlayerRef)throw new AppError("Select the goal scorer",422,"SCORER_REQUIRED");
   const [player,lot]=await Promise.all([this.repo.findPlayer(input.scorerPlayerRef),this.repo.findSoldLot(String(match.seasonRef),input.scorerPlayerRef)]);
   if(!player||player.status!=="active"||!lot||String(lot.seasonTeamRef)!==scoring)throw new AppError("Normal goal scorer must be an active player sold to the credited season team",422,"INVALID_SCORER");
   return {scoringSeasonTeamRef:new Types.ObjectId(scoring),scorerPlayerRef:new Types.ObjectId(input.scorerPlayerRef),playerSeasonTeamRef:new Types.ObjectId(scoring),goalType:"normal"};
  }
  if(!input.scorerPlayerRef)return {scoringSeasonTeamRef:new Types.ObjectId(scoring),scorerPlayerRef:null,playerSeasonTeamRef:null,goalType:"own_goal"};
  const [player,lot]=await Promise.all([this.repo.findPlayer(input.scorerPlayerRef),this.repo.findSoldLot(String(match.seasonRef),input.scorerPlayerRef)]);
  const responsibleTeam=scoring===home?away:home;
  if(!player||!lot||String(lot.seasonTeamRef)!==responsibleTeam)throw new AppError("Own-goal player must belong to the opposing season team",422,"INVALID_OWN_GOAL_PLAYER");
  return {scoringSeasonTeamRef:new Types.ObjectId(scoring),scorerPlayerRef:new Types.ObjectId(input.scorerPlayerRef),playerSeasonTeamRef:new Types.ObjectId(responsibleTeam),goalType:"own_goal"};
 }
 private buildShootout(input:CreateSeasonMatchDto["penaltyShootout"]):SeasonMatchFields["penaltyShootout"]{
  if(!input)return null;return {status:input.status,homeTeamScore:input.homeTeamScore,awayTeamScore:input.awayTeamScore,kicks:input.kicks.map(k=>({seasonTeamRef:new Types.ObjectId(k.seasonTeamRef),playerRef:k.playerRef?new Types.ObjectId(k.playerRef):null,result:k.result}))};
 }
 private async validateShootout(seasonId:string,match:SeasonMatchFields,shootout:NonNullable<SeasonMatchFields["penaltyShootout"]>):Promise<void>{
  const home=String(match.homeSeasonTeamRef),away=String(match.awaySeasonTeamRef);let homeScore=0,awayScore=0;
  for(const kick of shootout.kicks){
   const team=String(kick.seasonTeamRef);if(team!==home&&team!==away)throw new AppError("Shootout kick team must be part of this fixture",422,"INVALID_SHOOTOUT_TEAM");
   if(kick.playerRef){const lot=await this.repo.findSoldLot(seasonId,String(kick.playerRef));if(!lot||String(lot.seasonTeamRef)!==team)throw new AppError("Shootout player must belong to the kicking team",422,"INVALID_SHOOTOUT_PLAYER");}
   if(kick.result==="scored"){if(team===home)homeScore++;else awayScore++;}
  }
  if(shootout.kicks.length&&(homeScore!==shootout.homeTeamScore||awayScore!==shootout.awayTeamScore))throw new AppError("Shootout scores must match the recorded scored kicks",422,"SHOOTOUT_SCORE_MISMATCH");
  if(shootout.status==="completed"&&shootout.homeTeamScore===shootout.awayTeamScore)throw new AppError("A completed shootout must have a winner",422,"SHOOTOUT_TIED");
 }
 private calculateWinner(match:SeasonMatchFields,rules:{groupStageDrawAllowed:boolean;knockoutDrawRequiresShootout:boolean}):Types.ObjectId|null{
  const home=String(match.homeSeasonTeamRef),away=String(match.awaySeasonTeamRef);
  const homeGoals=match.goals.filter(g=>String(g.scoringSeasonTeamRef)===home).length,awayGoals=match.goals.filter(g=>String(g.scoringSeasonTeamRef)===away).length;
  if(match.stage==="group"){if(match.status!=="completed")return null;if(match.penaltyShootout)throw new AppError("Group-stage matches cannot have penalty shootouts",422,"GROUP_SHOOTOUT");if(match.status==="completed"&&homeGoals===awayGoals&&!rules.groupStageDrawAllowed)throw new AppError("Draws are not allowed by this season's group-stage rules",422,"GROUP_DRAW_NOT_ALLOWED");return homeGoals===awayGoals?null:new Types.ObjectId(homeGoals>awayGoals?home:away);}
  if(match.status!=="completed")return null;
  if(homeGoals===awayGoals){
   if(!rules.knockoutDrawRequiresShootout)return null;
   if(!match.penaltyShootout||match.penaltyShootout.status!=="completed")throw new AppError("A tied completed knockout match requires a completed penalty shootout",422,"SHOOTOUT_REQUIRED");
   if(match.penaltyShootout.homeTeamScore===match.penaltyShootout.awayTeamScore)throw new AppError("Penalty shootout must produce a winner",422,"SHOOTOUT_TIED");
   return new Types.ObjectId(match.penaltyShootout.homeTeamScore>match.penaltyShootout.awayTeamScore?home:away);
  }
  if(match.penaltyShootout)throw new AppError("A shootout is only allowed when normal-time scores are tied",422,"UNNECESSARY_SHOOTOUT");
  return new Types.ObjectId(homeGoals>awayGoals?home:away);
 }
 private mapTeam(ref:unknown):string|SeasonMatchTeamDto|null{
  if(!ref)return null;if(ref instanceof Types.ObjectId)return String(ref);
  const r=ref as any;if(!r.displayName)return String(r._id??r);
  const team=r.teamRef&&typeof r.teamRef==="object"&&r.teamRef.name?{_id:String(r.teamRef._id),name:r.teamRef.name,shortName:r.teamRef.shortName,logo:r.teamRef.logo}:null;
  return {_id:String(r._id),displayName:r.displayName,logoSnapshot:r.logoSnapshot,team};
 }
 private mapPlayer(ref:unknown):string|SeasonMatchPlayerDto|null{if(!ref)return null;if(ref instanceof Types.ObjectId)return String(ref);const p=ref as any;if(!p.name)return String(p._id??p);return {_id:String(p._id),name:p.name,profilePic:p.profilePic};}
 private mapGoal(g:PopulatedSeasonGoal):SeasonGoalResponseDto{return {_id:String(g._id),scoringSeasonTeamRef:this.mapTeam(g.scoringSeasonTeamRef)!,scorerPlayerRef:this.mapPlayer(g.scorerPlayerRef),playerSeasonTeamRef:this.mapTeam(g.playerSeasonTeamRef),goalType:g.goalType,createdAt:g.createdAt.toISOString()};}
 private map(m:PopulatedSeasonMatch):SeasonMatchResponseDto{return {_id:String(m._id),seasonRef:String(m.seasonRef),matchNumber:m.matchNumber,stage:m.stage,groupRef:m.groupRef?String(m.groupRef):null,kickoffAt:m.kickoffAt.toISOString(),venue:m.venue,homeSeasonTeamRef:this.mapTeam(m.homeSeasonTeamRef)!,awaySeasonTeamRef:this.mapTeam(m.awaySeasonTeamRef)!,status:m.status,goals:m.goals.map(g=>this.mapGoal(g)),penaltyShootout:m.penaltyShootout?{status:m.penaltyShootout.status,homeTeamScore:m.penaltyShootout.homeTeamScore,awayTeamScore:m.penaltyShootout.awayTeamScore,kicks:m.penaltyShootout.kicks.map(k=>({seasonTeamRef:String(k.seasonTeamRef),playerRef:k.playerRef?String(k.playerRef):null,result:k.result}))}:null,winnerSeasonTeamRef:this.mapTeam(m.winnerSeasonTeamRef),notes:m.notes,createdAt:m.createdAt.toISOString(),updatedAt:m.updatedAt.toISOString()};}
 private id(value:string,label:string){if(!Types.ObjectId.isValid(value))throw new AppError("Invalid "+label+" ID",400,"INVALID_ID");}
}
