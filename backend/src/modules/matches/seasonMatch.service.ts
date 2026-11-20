import {Types} from "mongoose";
import {getPairFixtureError} from "./seasonMatch.fixtureRules.js";
import {requiresAuctionForFixtureMutation} from "./seasonMatch.auctionAccess.js";
import {assertStageMatchesResolved,groupStageQualifiers,qualifiedTeamsForStage} from "./seasonMatch.qualification.js";
import {isKickoffWithinSeasonDateWindow,isSeasonReadOnly} from "../seasons/season.rules.js";
import {assertPenaltyShootoutScore,calculateCompletedMatchWinner} from "./seasonMatch.completionRules.js";
import {assertMatchStatusTransition} from "./seasonMatch.statusRules.js";
import {AppError} from "../../shared/errors/appError.js";
import type {PaginatedResult} from "../../shared/types/common.types.js";
import type {SeasonMatchRepository} from "./seasonMatch.repository.js";
import type {ISeasonMatchService} from "./seasonMatch.interfaces.js";
import type {CreateSeasonMatchDto,UpdateSeasonMatchDto,SeasonMatchQueryDto,SeasonGoalDto,SeasonMatchResponseDto,SeasonGoalResponseDto,SeasonMatchTeamDto,SeasonMatchPlayerDto} from "./seasonMatch.dto.js";
import type {SeasonMatchFields,SeasonMatchEntity,PopulatedSeasonMatch,PopulatedSeasonGoal} from "./seasonMatch.types.js";


function statusPostponementDateChanged(
 currentStatus:SeasonMatchFields["status"],
 nextStatus:SeasonMatchFields["status"],
 requestedKickoffAt:Date|undefined,
 currentKickoffAt:Date,
):boolean{
 return (currentStatus!=="postponed"&&nextStatus==="postponed"
  &&requestedKickoffAt!==undefined
  &&requestedKickoffAt.getTime()!==currentKickoffAt.getTime());
}

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
  if(season.auctionLifecycleStatus!=="completed")throw new AppError("Complete the auction and validate every team roster before creating fixtures.",409,"AUCTION_NOT_COMPLETED");
  if(!season.matchRules)throw new AppError("Match rules are unavailable for this historical season",409,"SEASON_RULES_UNAVAILABLE");
  if(input.stage==="group"&&!season.groupStageEnabled)throw new AppError("Group-stage fixtures are disabled for this season",409,"GROUP_STAGE_DISABLED");
  this.assertKickoffWithinSeason(season,input.kickoffAt);
  if(await this.repo.findByNumber(seasonId,input.matchNumber))throw new AppError("Match number already exists in this season",409,"DUPLICATE_MATCH_NUMBER");
  const homeId=input.homeSeasonTeamRef,awayId=input.awaySeasonTeamRef;
  await this.validateSeasonTeams(seasonId,homeId,awayId,input.stage,input.groupRef??null);
  await this.validateFixturePair(seasonId,input.stage,input.groupRef??null,input.roundNumber,homeId,awayId,season.homeAndAwayFixtures??false);
  const venue=await this.repo.findVenue(input.venueRef);
  if(!venue||venue.status!=="active")throw new AppError("Choose an active venue from the venue list",422,"INVALID_VENUE",{venueRef:"Choose an active venue"});
  await this.validateKnockoutQualification(seasonId,input.stage,homeId,awayId,season);
  const fields:SeasonMatchFields={seasonRef:new Types.ObjectId(seasonId),matchNumber:input.matchNumber,roundNumber:input.roundNumber,stage:input.stage,groupRef:input.stage==="group"&&input.groupRef?new Types.ObjectId(input.groupRef):null,kickoffAt:input.kickoffAt,venueRef:new Types.ObjectId(input.venueRef),homeSeasonTeamRef:new Types.ObjectId(homeId),awaySeasonTeamRef:new Types.ObjectId(awayId),status:"scheduled",goals:[],penaltyShootout:null,winnerSeasonTeamRef:null,notes:input.notes??null,resolutionHistory:[]};
  if(input.status!==undefined&&input.status!=="scheduled")throw new AppError("New fixtures must start as Scheduled",422,"INVALID_INITIAL_MATCH_STATUS");
  if(fields.status==="completed")throw new AppError("Create fixtures as scheduled, record goals, then complete the match",422,"INVALID_MATCH_COMPLETION");
  const created=await this.repo.create(fields,season.homeAndAwayFixtures??false);const populated=await this.repo.findPopulatedById(String(created._id));if(!populated)throw new AppError("Created fixture could not be retrieved",500,"MATCH_CREATE_FAILED");return this.map(populated);
 }
 async update(id:string,input:UpdateSeasonMatchDto,changedBy?:string):Promise<SeasonMatchResponseDto>{
  this.id(id,"match");const existing=await this.repo.findById(id);if(!existing)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");
  const season=await this.repo.findSeason(String(existing.seasonRef));if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  if(["completed","archived"].includes(season.status))throw new AppError("Completed or archived season matches are read-only",409,"SEASON_CLOSED");
  const nextStatus=input.status??existing.status;
  if(existing.status==="postponed"&&(nextStatus==="scheduled"||input.kickoffAt!==undefined)){
   throw new AppError("Postponed matches can only be returned to Scheduled through the reschedule operation with a new kickoff date and time",409,"MATCH_RESCHEDULE_REQUIRED");
  }
  if(statusPostponementDateChanged(existing.status,nextStatus,input.kickoffAt,existing.kickoffAt)){
   throw new AppError("The original kickoff date must be preserved when postponing. Use the dedicated reschedule operation to set a new date and time.",422,"POSTPONEMENT_KICKOFF_CHANGE_NOT_ALLOWED");
  }
  assertMatchStatusTransition(existing.status,nextStatus);
  if(existing.status==="completed")throw new AppError("Completed fixtures can only be changed through the audited correction workflow.",409,"MATCH_DETAILS_EDIT_NOT_ALLOWED");
  const isFixtureDetailsEdit=requiresAuctionForFixtureMutation(input);
  const existingCards=(existing as SeasonMatchEntity&{cards?:unknown[]}).cards??[];
  if(isFixtureDetailsEdit&&season.auctionLifecycleStatus!=="completed")throw new AppError("Complete the auction before editing fixture details or schedules.",409,"AUCTION_NOT_COMPLETED");
  if(isFixtureDetailsEdit){
   if(existing.status!=="scheduled"&&existing.status!=="live"){
    throw new AppError("Only Scheduled or Live matches can be edited.",409,"MATCH_DETAILS_EDIT_NOT_ALLOWED");
   }
   if((existing.goals??[]).length>0||existingCards.length>0){
    throw new AppError("Match details cannot be edited after goals or cards have been recorded.",409,"MATCH_HAS_EVENTS");
   }
  }
  if(existing.status==="live"&&nextStatus==="scheduled"&&(existing.goals??[]).length>0){
   throw new AppError("Remove all recorded goal events before reverting this Live match to Scheduled.",409,"MATCH_HAS_GOALS",{goals:"Delete every recorded goal event first"});
  }
  const statusChanged=nextStatus!==existing.status;
  const statusReasonValue=input.statusReason?.trim();
  const resolutionReasonValue=input.resolutionReason?.trim();
  if(statusReasonValue!==undefined&&resolutionReasonValue!==undefined&&statusReasonValue!==resolutionReasonValue){
   throw new AppError("Use one consistent reason for the status change",422,"CONFLICTING_STATUS_REASONS",{statusReason:"Use one consistent reason"});
  }
  if(input.resolutionReason!==undefined&&nextStatus!=="cancelled"&&nextStatus!=="abandoned")throw new AppError("A resolution reason is only valid when cancelling or abandoning a fixture",422,"INVALID_FIXTURE_RESOLUTION");
  const statusReason=statusReasonValue??resolutionReasonValue??null;
  if(!statusChanged&&(input.statusReason!==undefined||input.resolutionReason!==undefined)){
   throw new AppError("A status-change reason can only be supplied when the match status changes",422,"STATUS_REASON_WITHOUT_TRANSITION");
  }
  const requiresStatusReason=["postponed","cancelled","abandoned"].includes(nextStatus)||(existing.status==="live"&&nextStatus==="scheduled");
  if(statusChanged&&requiresStatusReason&&!statusReason){
   throw new AppError("A reason is required when postponing, cancelling, abandoning or reverting a match",422,"MATCH_STATUS_REASON_REQUIRED",{statusReason:"Enter a reason of at least 3 characters"});
  }
  if(statusReason!==null&&(statusReason.length<3||statusReason.length>500)){
   throw new AppError("Enter a status-change reason between 3 and 500 characters",422,"INVALID_MATCH_STATUS_REASON",{statusReason:"Reason must contain 3 to 500 characters"});
  }
  let statusHistoryEntry:import("./seasonMatch.types.js").SeasonMatchStatusHistoryEntry|undefined;
  const changedAt=statusChanged?new Date():null;
  if(statusChanged){
   if(!changedBy||!Types.ObjectId.isValid(changedBy))throw new AppError("An authenticated user is required to change match status",401,"UNAUTHENTICATED");
   statusHistoryEntry={fromStatus:existing.status,toStatus:nextStatus,reason:statusReason,changedBy:new Types.ObjectId(changedBy),changedAt:changedAt!,fromKickoffAt:existing.kickoffAt,toKickoffAt:input.kickoffAt??existing.kickoffAt};
  }

  if(!season.matchRules)throw new AppError("Match rules are unavailable for this historical season",409,"SEASON_RULES_UNAVAILABLE");
  const homeId=input.homeSeasonTeamRef??String(existing.homeSeasonTeamRef),awayId=input.awaySeasonTeamRef??String(existing.awaySeasonTeamRef);
  const stage=input.stage??existing.stage,groupId=input.groupRef===undefined?(existing.groupRef?String(existing.groupRef):null):input.groupRef;
  const roundNumber=input.roundNumber??existing.roundNumber,venueRef=input.venueRef??String(existing.venueRef);
  await this.validateSeasonTeams(String(existing.seasonRef),homeId,awayId,stage,groupId);
  const pairChanged=homeId!==String(existing.homeSeasonTeamRef)||awayId!==String(existing.awaySeasonTeamRef)||stage!==existing.stage||groupId!==(existing.groupRef?String(existing.groupRef):null)||roundNumber!==existing.roundNumber;
  if(pairChanged)await this.validateFixturePair(String(existing.seasonRef),stage,groupId,roundNumber,homeId,awayId,season.homeAndAwayFixtures??false,id);
  const venue=await this.repo.findVenue(venueRef);
  if(!venue||(venue.status!=="active"&&venueRef!==String(existing.venueRef)))throw new AppError("Choose an active venue from the venue list",422,"INVALID_VENUE",{venueRef:"Choose an active venue"});
  await this.validateKnockoutQualification(String(existing.seasonRef),stage,homeId,awayId,season);
  const kickoffAt=input.kickoffAt??existing.kickoffAt;
  this.assertKickoffWithinSeason(season,kickoffAt);
  if(stage==="group"&&!season.groupStageEnabled)throw new AppError("Group-stage fixtures are disabled for this season",409,"GROUP_STAGE_DISABLED");
  const teamsChanged=homeId!==String(existing.homeSeasonTeamRef)||awayId!==String(existing.awaySeasonTeamRef);
  const structureChanged=stage!==existing.stage||groupId!==(existing.groupRef?String(existing.groupRef):null);
  if((teamsChanged||structureChanged)&&(existing.goals.length>0||(existing.resolutionHistory??[]).length>0))throw new AppError("Participating teams, stage and group cannot be changed after goal or resolution history has been recorded",409,"MATCH_HAS_HISTORY");
  const number=input.matchNumber??existing.matchNumber;
  if(number!==existing.matchNumber){const duplicate=await this.repo.findByNumber(String(existing.seasonRef),number);if(duplicate&&String(duplicate._id)!==id)throw new AppError("Match number already exists in this season",409,"DUPLICATE_MATCH_NUMBER");}
  const resolutionHistory=[...(existing.resolutionHistory??[])];
  if(statusChanged&&(nextStatus==="cancelled"||nextStatus==="abandoned")){
   resolutionHistory.push({status:nextStatus,reason:statusReason!,decidedAt:changedAt!});
  }
  const merged:SeasonMatchFields={...existing,matchNumber:number,roundNumber,stage,groupRef:stage==="group"&&groupId?new Types.ObjectId(groupId):null,kickoffAt,venueRef:new Types.ObjectId(venueRef),homeSeasonTeamRef:new Types.ObjectId(homeId),awaySeasonTeamRef:new Types.ObjectId(awayId),status:nextStatus,penaltyShootout:existing.status==="live"&&nextStatus==="scheduled"?null:input.penaltyShootout===undefined?existing.penaltyShootout:this.buildShootout(input.penaltyShootout),notes:input.notes===undefined?existing.notes:input.notes,winnerSeasonTeamRef:existing.status==="live"&&nextStatus==="scheduled"?null:existing.winnerSeasonTeamRef,resolutionHistory};
  if(merged.penaltyShootout)await this.validateShootout(String(existing.seasonRef),merged,merged.penaltyShootout);
  merged.winnerSeasonTeamRef=this.calculateWinner(merged,season.matchRules,season.pointsRules);
  const saved=await this.repo.update(id,{matchNumber:merged.matchNumber,roundNumber:merged.roundNumber,stage:merged.stage,groupRef:merged.groupRef,kickoffAt:merged.kickoffAt,venueRef:merged.venueRef,homeSeasonTeamRef:merged.homeSeasonTeamRef,awaySeasonTeamRef:merged.awaySeasonTeamRef,status:merged.status,penaltyShootout:merged.penaltyShootout,winnerSeasonTeamRef:merged.winnerSeasonTeamRef,notes:merged.notes,resolutionHistory:merged.resolutionHistory},season.homeAndAwayFixtures??false,statusHistoryEntry?{expectedStatus:existing.status,entry:statusHistoryEntry,requireNoGoals:existing.status==="live"&&nextStatus==="scheduled"}:undefined,{requireEditableWithoutEvents:isFixtureDetailsEdit,requireAuctionCompleted:isFixtureDetailsEdit});
  if(!saved)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");const populated=await this.repo.findPopulatedById(id);if(!populated)throw new AppError("Updated fixture could not be retrieved",500,"MATCH_UPDATE_FAILED");return this.map(populated);
 }
 async reschedule(id:string,input:import("./seasonMatch.dto.js").RescheduleSeasonMatchDto,changedBy?:string):Promise<SeasonMatchResponseDto>{
  this.id(id,"match");
  const existing=await this.repo.findById(id);
  if(!existing)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");
  if(existing.status!=="postponed")throw new AppError("Only Postponed matches can be rescheduled",409,"MATCH_NOT_POSTPONED");
  assertMatchStatusTransition(existing.status,"scheduled");
  const season=await this.repo.findSeason(String(existing.seasonRef));
  if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  if(season.auctionLifecycleStatus!=="completed")throw new AppError("Complete the auction before rescheduling this fixture.",409,"AUCTION_NOT_COMPLETED");
  if(!["upcoming","active"].includes(season.status))throw new AppError("Only Upcoming or Active season matches can be rescheduled",409,"SEASON_CLOSED");
  if(!(input.kickoffAt instanceof Date)||Number.isNaN(input.kickoffAt.getTime())){
   throw new AppError("A valid new match date and kick-off time are required",422,"RESCHEDULE_KICKOFF_REQUIRED",{kickoffAt:"Enter a valid date and kick-off time"});
  }
  if(input.kickoffAt.getTime()<=Date.now())throw new AppError("Choose a future date and kick-off time when rescheduling",422,"RESCHEDULE_KICKOFF_NOT_FUTURE",{kickoffAt:"The new kickoff must be in the future"});
  if(input.kickoffAt.getTime()===existing.kickoffAt.getTime())throw new AppError("Choose a new date or kick-off time different from the postponed fixture",422,"RESCHEDULE_KICKOFF_UNCHANGED",{kickoffAt:"Choose a different date or time"});
  this.assertKickoffWithinSeason(season,input.kickoffAt);
  const reason=input.reason?.trim()??null;
  if(reason!==null&&(reason.length<3||reason.length>500))throw new AppError("Enter a rescheduling reason between 3 and 500 characters",422,"INVALID_RESCHEDULE_REASON",{reason:"Reason must contain 3 to 500 characters"});
  if(!changedBy||!Types.ObjectId.isValid(changedBy))throw new AppError("An authenticated user is required to reschedule a match",401,"UNAUTHENTICATED");
  const changedAt=new Date();
  const statusHistoryEntry:import("./seasonMatch.types.js").SeasonMatchStatusHistoryEntry={
   fromStatus:"postponed",
   toStatus:"scheduled",
   reason,
   changedBy:new Types.ObjectId(changedBy),
   changedAt,
   fromKickoffAt:existing.kickoffAt,
   toKickoffAt:input.kickoffAt,
  };
  const saved=await this.repo.update(
   id,
   {status:"scheduled",kickoffAt:input.kickoffAt},
   season.homeAndAwayFixtures??false,
   {expectedStatus:"postponed",entry:statusHistoryEntry},
  );
  if(!saved)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");
  const populated=await this.repo.findPopulatedById(id);
  if(!populated)throw new AppError("Rescheduled match could not be retrieved",500,"MATCH_UPDATE_FAILED");
  return this.map(populated);
 }
 async correctCompletedMatch(id:string,input:import("./seasonMatch.dto.js").CorrectCompletedMatchDto,correctedBy?:string):Promise<SeasonMatchResponseDto>{
  this.id(id,"match");
  if(!correctedBy||!Types.ObjectId.isValid(correctedBy))throw new AppError("An authenticated administrator is required to correct a completed match",403,"FORBIDDEN");
  const reason=input.reason.trim();
  if(reason.length<3||reason.length>1000)throw new AppError("Enter a correction reason between 3 and 1000 characters",422,"MATCH_CORRECTION_REASON_REQUIRED",{reason:"A correction reason is required"});
  const existing=await this.repo.findById(id);
  if(!existing)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");
  if(existing.status!=="completed")throw new AppError("Only Completed matches can use the correction workflow",409,"MATCH_NOT_COMPLETED");
  const season=await this.repo.findSeason(String(existing.seasonRef));
  if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  if(season.status==="archived")throw new AppError("Archived seasons cannot be corrected",409,"SEASON_CLOSED");
  if(!season.matchRules)throw new AppError("Match rules are unavailable for this historical season",409,"SEASON_RULES_UNAVAILABLE");
  const correctedAt=new Date();
  const reusedGoalIds=new Set<string>();
  const correctedGoals=await Promise.all(input.goals.map(async goal=>{
   const existingGoal=existing.goals.find(candidate=>{
    const candidateId=String(candidate._id);
    return !reusedGoalIds.has(candidateId)
     && String(candidate.scoringSeasonTeamRef)===goal.scoringSeasonTeamRef
     && String(candidate.scorerPlayerRef??"")===(goal.scorerPlayerRef??"")
     && candidate.goalType===goal.goalType;
   });
   if(existingGoal){reusedGoalIds.add(String(existingGoal._id));return existingGoal;}
   return {...await this.buildGoal(existing,goal),_id:new Types.ObjectId(),createdAt:correctedAt};
  }));
  const shootout=input.penaltyShootout?this.buildShootout(input.penaltyShootout):null;
  if(shootout)await this.validateShootout(String(existing.seasonRef),existing,shootout);
  const correctedMatch:SeasonMatchFields={...existing,status:"completed",goals:correctedGoals,penaltyShootout:shootout,winnerSeasonTeamRef:null};
  const winner=this.calculateWinner(correctedMatch,season.matchRules,season.pointsRules);
  correctedMatch.winnerSeasonTeamRef=winner;
  const rules=await import("./seasonMatch.completionRules.js");
  const originalScore=rules.deriveMatchScore(existing),correctedScore=rules.deriveMatchScore(correctedMatch);
  const snapshot=(match:SeasonMatchFields,score:{homeScore:number;awayScore:number})=>({
   homeScore:score.homeScore,awayScore:score.awayScore,goals:match.goals.map(goal=>({...goal})),
   penaltyShootout:match.penaltyShootout?{...match.penaltyShootout,kicks:match.penaltyShootout.kicks.map(kick=>({...kick}))}:null,
   winnerSeasonTeamRef:match.winnerSeasonTeamRef,
  });
  const historyEntry:import("./seasonMatch.types.js").SeasonMatchCorrectionHistoryEntry={
   reason,correctedBy:new Types.ObjectId(correctedBy),correctedAt,
   originalResult:snapshot(existing,originalScore),correctedResult:snapshot(correctedMatch,correctedScore),
  };
  const saved=await this.repo.correctCompletedMatch(id,existing.updatedAt,correctedGoals,shootout,winner,historyEntry);
  if(!saved)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");
  const populated=await this.repo.findPopulatedById(id);
  if(!populated)throw new AppError("Corrected match could not be retrieved",500,"MATCH_CORRECTION_FAILED");
  return this.map(populated);
 }

 async delete(id:string):Promise<void>{this.id(id,"match");const existing=await this.repo.findById(id);if(!existing)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");const season=await this.repo.findSeason(String(existing.seasonRef));if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");if(season.auctionLifecycleStatus!=="completed")throw new AppError("Complete the auction before deleting fixtures.",409,"AUCTION_NOT_COMPLETED");if(isSeasonReadOnly(season.status))throw new AppError("Completed or archived seasons are read-only",409,"SEASON_CLOSED");const deleted=await this.repo.delete(id);if(!deleted)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");}
 async addGoal(id:string,input:SeasonGoalDto):Promise<SeasonMatchResponseDto>{const match=await this.getExisting(id);this.assertGoalManagementAllowed(match);const goal=await this.buildGoal(match,input);const result={...match,goals:[...match.goals,goal]};const season=await this.repo.findSeason(String(match.seasonRef));if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");if(!season.matchRules)throw new AppError("Match rules are unavailable for this season",409,"SEASON_RULES_UNAVAILABLE");const winner=this.calculateWinner({...match,goals:result.goals},season.matchRules,season.pointsRules);const saved=await this.repo.appendGoalWithWinner(id,goal,winner?new Types.ObjectId(String(winner)):null);if(!saved){const latest=await this.repo.findById(id);if(latest&&latest.status!=="live")throw new AppError("Goals can only be added, edited or removed while the match is Live.",409,"MATCH_NOT_LIVE");throw new AppError("Match not found",404,"MATCH_NOT_FOUND");}const populated=await this.repo.findPopulatedById(id);if(!populated)throw new AppError("Updated match could not be retrieved",500,"MATCH_UPDATE_FAILED");return this.map(populated);}
 async updateGoal(id:string,goalId:string,input:SeasonGoalDto):Promise<SeasonMatchResponseDto>{const match=await this.getExisting(id);this.assertGoalManagementAllowed(match);this.id(goalId,"goal");if(!match.goals.some(g=>String(g._id)===goalId))throw new AppError("Goal not found",404,"GOAL_NOT_FOUND");const goal=await this.buildGoal(match,input);const goals=match.goals.map(g=>String(g._id)===goalId?goal:g);const season=await this.repo.findSeason(String(match.seasonRef));if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");if(!season.matchRules)throw new AppError("Match rules are unavailable for this season",409,"SEASON_RULES_UNAVAILABLE");const winner=this.calculateWinner({...match,goals},season.matchRules,season.pointsRules);const saved=await this.repo.updateGoalWithWinner(id,goalId,goal,winner?new Types.ObjectId(String(winner)):null);if(!saved){const latest=await this.repo.findById(id);if(latest&&latest.status!=="live")throw new AppError("Goals can only be added, edited or removed while the match is Live.",409,"MATCH_NOT_LIVE");throw new AppError("Goal not found",404,"GOAL_NOT_FOUND");}const populated=await this.repo.findPopulatedById(id);if(!populated)throw new AppError("Updated match could not be retrieved",500,"MATCH_UPDATE_FAILED");return this.map(populated);}
 async deleteGoal(id:string,goalId:string):Promise<SeasonMatchResponseDto>{const match=await this.getExisting(id);this.assertGoalManagementAllowed(match);this.id(goalId,"goal");const goals=match.goals.filter(g=>String(g._id)!==goalId);if(goals.length===match.goals.length)throw new AppError("Goal not found",404,"GOAL_NOT_FOUND");const season=await this.repo.findSeason(String(match.seasonRef));if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");if(!season.matchRules)throw new AppError("Match rules are unavailable for this season",409,"SEASON_RULES_UNAVAILABLE");const winner=this.calculateWinner({...match,goals},season.matchRules,season.pointsRules);const saved=await this.repo.removeGoalWithWinner(id,goalId,winner?new Types.ObjectId(String(winner)):null);if(!saved)throw new AppError("Goal not found",404,"GOAL_NOT_FOUND");const populated=await this.repo.findPopulatedById(id);if(!populated)throw new AppError("Updated match could not be retrieved",500,"MATCH_UPDATE_FAILED");return this.map(populated);}
 private async validateKnockoutQualification(seasonId:string,stage:SeasonMatchFields["stage"],homeId:string,awayId:string,season:NonNullable<Awaited<ReturnType<SeasonMatchRepository["findSeason"]>>>):Promise<void>{
  if(stage==="group")return;
  const [teams,groupMatches,roundOf16,quarterFinals,semiFinals]=await Promise.all([
   this.repo.findSeasonTeams(seasonId),
   this.repo.findByStage(seasonId,"group"),
   this.repo.findByStage(seasonId,"round_of_16"),
   this.repo.findByStage(seasonId,"quarter_final"),
   this.repo.findByStage(seasonId,"semi_final"),
  ]);
  let groupQualifiers=new Set<string>();
  if(season.groupStageEnabled){
   if(!season.pointsRules)throw new AppError("Season points rules are required to validate group qualification",409,"SEASON_POINTS_RULES_UNAVAILABLE");
   if(!groupMatches.length||groupMatches.some(match=>!["completed","cancelled","abandoned"].includes(match.status)))throw new AppError("All group-stage fixtures must be resolved before knockout qualification can be confirmed",409,"GROUP_STAGE_NOT_COMPLETE");
   groupQualifiers=groupStageQualifiers(teams,groupMatches,season.pointsRules,2);
  }
  const activeTeamIds=new Set(teams.filter(team=>team.status==="active").map(team=>String(team._id)));
  const previousMatches=stage==="quarter_final"?roundOf16:stage==="semi_final"?(quarterFinals.length?quarterFinals:roundOf16):stage==="final"||stage==="third_place"?semiFinals:[];
  if(previousMatches.length){
   try{assertStageMatchesResolved(previousMatches,stage==="quarter_final"?"Round of 16":stage==="semi_final"?(quarterFinals.length?"Quarter-final":"Round of 16"):"Semi-final");}
   catch(error){throw new AppError(error instanceof Error?error.message:"Previous knockout fixtures are not complete",409,"KNOCKOUT_STAGE_NOT_COMPLETE");}
  }
  if((stage==="final"||stage==="third_place")&&!semiFinals.length)throw new AppError("Semi-final fixtures must be recorded before creating the final or third-place playoff",409,"SEMI_FINALS_REQUIRED");
  const eligible=qualifiedTeamsForStage(stage,groupQualifiers,activeTeamIds,roundOf16,quarterFinals,semiFinals);
  if(!eligible.has(homeId)||!eligible.has(awayId))throw new AppError("Both teams must have qualified for this knockout stage based on the completed group standings or previous knockout results",422,"KNOCKOUT_QUALIFICATION_REQUIRED");
 }
 private async validateFixturePair(seasonId:string,stage:SeasonMatchFields["stage"],groupId:string|null,roundNumber:number,homeId:string,awayId:string,homeAndAway:boolean,excludeId?:string):Promise<void>{
  const fixtures=await this.repo.findPairFixtures(seasonId,stage,stage==="group"?groupId:null,homeId,awayId);
  const issue=getPairFixtureError(fixtures,roundNumber,homeId,awayId,homeAndAway,excludeId);
  if(issue==="DUPLICATE_PAIR_IN_ROUND")throw new AppError("These two teams already have a fixture in this round. Reversing home and away does not create a separate round fixture.",409,issue,{roundNumber:"This team pairing already exists in the selected round"});
  if(issue==="DUPLICATE_TEAM_PAIR")throw new AppError("This team pairing already has a fixture. Enable Home and Away Fixtures in the season settings to schedule the return fixture.",409,issue,{homeSeasonTeamRef:"This team pair already has a fixture"});
  if(issue==="PAIR_FIXTURE_LIMIT")throw new AppError("A team pair can have at most two fixtures in a home-and-away season",409,issue);
  if(issue==="DUPLICATE_HOME_AWAY_ORIENTATION")throw new AppError("This home/away orientation already exists. The return fixture must reverse the home and away teams.",409,issue,{homeSeasonTeamRef:"Reverse the home and away teams for the return fixture"});
 }
 private assertKickoffWithinSeason(season:NonNullable<Awaited<ReturnType<SeasonMatchRepository["findSeason"]>>>,kickoffAt:Date):void{
  if(!isKickoffWithinSeasonDateWindow(kickoffAt,{startDate:season.startDate,endDate:season.endDate,timeZone:season.timeZone})){
   const day=new Intl.DateTimeFormat("en-CA",{timeZone:season.timeZone}).format(kickoffAt);
   const start=season.startDate?season.startDate.toISOString().slice(0,10):null;
   const end=season.endDate?season.endDate.toISOString().slice(0,10):null;
   if(start&&day<start)throw new AppError("Fixture date is before the season start date",422,"FIXTURE_BEFORE_SEASON",{kickoffAt:"Choose a fixture date on or after "+start});
   throw new AppError("Fixture date is after the season end date",422,"FIXTURE_AFTER_SEASON",{kickoffAt:"Choose a fixture date on or before "+end});
  }
 }
 private async validateSeasonTeams(seasonId:string,homeId:string,awayId:string,stage:SeasonMatchFields["stage"],groupId:string|null):Promise<void>{
  if(homeId===awayId)throw new AppError("A team cannot play itself",422,"SAME_TEAMS");
  const [home,away]=await Promise.all([this.repo.findSeasonTeam(seasonId,homeId),this.repo.findSeasonTeam(seasonId,awayId)]);
  if(!home||!away||["withdrawn","eliminated","completed"].includes(home.status)||["withdrawn","eliminated","completed"].includes(away.status))throw new AppError("Both teams must be participating in the selected season",422,"INVALID_SEASON_TEAMS");
  if(stage!=="group"&&(home.status!=="active"||away.status!=="active"))throw new AppError("Only Active season teams can be selected for knockout fixtures",422,"KNOCKOUT_TEAM_NOT_ACTIVE");
  if(stage==="group"){
   if(!groupId)throw new AppError("Group is required for a group-stage fixture",422,"GROUP_REQUIRED");
   const group=await this.repo.findGroup(seasonId,groupId);if(!group)throw new AppError("Select a group from this season",422,"INVALID_GROUP");
   if(String(home.groupRef)!==groupId||String(away.groupRef)!==groupId)throw new AppError("Both teams must be assigned to the selected group",422,"GROUP_MISMATCH");
  }else if(groupId){throw new AppError("Knockout fixtures cannot belong to a group",422,"INVALID_GROUP_STAGE");}
 }
 private assertGoalManagementAllowed(match:SeasonMatchEntity):void{
  if(match.status!=="live"){
   throw new AppError("Goals can only be added, edited or removed while the match is Live. Existing goal records are preserved when a match changes status.",409,"MATCH_GOAL_MANAGEMENT_NOT_ALLOWED");
  }
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
  assertPenaltyShootoutScore(match,shootout);
  for(const kick of shootout.kicks){
   if(kick.playerRef){
    const team=String(kick.seasonTeamRef);
    const lot=await this.repo.findSoldLot(seasonId,String(kick.playerRef));
    if(!lot||String(lot.seasonTeamRef)!==team)throw new AppError("Shootout player must belong to the kicking team",422,"INVALID_SHOOTOUT_PLAYER");
   }
  }
 }
 private calculateWinner(
  match:SeasonMatchFields,
  rules:{groupStageDrawAllowed:boolean;knockoutDrawRequiresShootout:boolean},
  pointsRules:import("../seasons/season.types.js").SeasonPointsRules|null,
 ):Types.ObjectId|null{
  const winner=calculateCompletedMatchWinner(match,rules,pointsRules);
  return winner?new Types.ObjectId(winner):null;
 }
 private mapTeam(ref:unknown):string|SeasonMatchTeamDto|null{
  if(!ref)return null;if(ref instanceof Types.ObjectId)return String(ref);
  const r=ref as any;if(!r.displayName)return String(r._id??r);
  const team=r.teamRef&&typeof r.teamRef==="object"&&r.teamRef.name?{_id:String(r.teamRef._id),name:r.teamRef.name,shortName:r.teamRef.shortName,logo:r.teamRef.logo}:null;
  return {_id:String(r._id),displayName:r.teamRef?.name??r.displayName,logoSnapshot:r.teamRef?.logo??r.logoSnapshot,team};
 }
 private mapPlayer(ref:unknown):string|SeasonMatchPlayerDto|null{if(!ref)return null;if(ref instanceof Types.ObjectId)return String(ref);const p=ref as any;if(!p.name)return String(p._id??p);return {_id:String(p._id),name:p.name,profilePic:p.profilePic};}
 private mapGoal(g:PopulatedSeasonGoal):SeasonGoalResponseDto{return {_id:String(g._id),scoringSeasonTeamRef:this.mapTeam(g.scoringSeasonTeamRef)!,scorerPlayerRef:this.mapPlayer(g.scorerPlayerRef),playerSeasonTeamRef:this.mapTeam(g.playerSeasonTeamRef),goalType:g.goalType,createdAt:g.createdAt.toISOString()};}
 private map(m:PopulatedSeasonMatch):SeasonMatchResponseDto{const venue=m.venueRef&&!(m.venueRef instanceof Types.ObjectId)&&typeof m.venueRef==="object"?{_id:String(m.venueRef._id),name:m.venueRef.name,location:m.venueRef.location}:String(m.venueRef);return {_id:String(m._id),seasonRef:String(m.seasonRef),matchNumber:m.matchNumber,roundNumber:m.roundNumber,stage:m.stage,groupRef:m.groupRef?String(m.groupRef):null,kickoffAt:m.kickoffAt.toISOString(),venueRef:venue,venue:typeof venue==="string"?null:venue.name,homeSeasonTeamRef:this.mapTeam(m.homeSeasonTeamRef)!,awaySeasonTeamRef:this.mapTeam(m.awaySeasonTeamRef)!,status:m.status,goals:m.goals.map(g=>this.mapGoal(g)),resolutionHistory:(m.resolutionHistory??[]).map(entry=>({status:entry.status,reason:entry.reason,decidedAt:entry.decidedAt.toISOString()})),statusHistory:(m.statusHistory??[]).map(entry=>({fromStatus:entry.fromStatus,toStatus:entry.toStatus,reason:entry.reason??null,changedBy:String(entry.changedBy),changedAt:entry.changedAt.toISOString(),fromKickoffAt:entry.fromKickoffAt?.toISOString()??null,toKickoffAt:entry.toKickoffAt?.toISOString()??null})),correctionHistory:(m.correctionHistory??[]).map(entry=>({reason:entry.reason,correctedBy:String(entry.correctedBy),correctedAt:entry.correctedAt.toISOString(),originalResult:{homeScore:entry.originalResult.homeScore,awayScore:entry.originalResult.awayScore,goals:entry.originalResult.goals.map(g=>({_id:String(g._id),scoringSeasonTeamRef:String(g.scoringSeasonTeamRef),scorerPlayerRef:g.scorerPlayerRef?String(g.scorerPlayerRef):null,playerSeasonTeamRef:g.playerSeasonTeamRef?String(g.playerSeasonTeamRef):null,goalType:g.goalType,createdAt:g.createdAt?.toISOString()??entry.correctedAt.toISOString()})),penaltyShootout:entry.originalResult.penaltyShootout?{...entry.originalResult.penaltyShootout,kicks:entry.originalResult.penaltyShootout.kicks.map(k=>({seasonTeamRef:String(k.seasonTeamRef),playerRef:k.playerRef?String(k.playerRef):null,result:k.result}))}:null,winnerSeasonTeamRef:entry.originalResult.winnerSeasonTeamRef?String(entry.originalResult.winnerSeasonTeamRef):null},correctedResult:{homeScore:entry.correctedResult.homeScore,awayScore:entry.correctedResult.awayScore,goals:entry.correctedResult.goals.map(g=>({_id:String(g._id),scoringSeasonTeamRef:String(g.scoringSeasonTeamRef),scorerPlayerRef:g.scorerPlayerRef?String(g.scorerPlayerRef):null,playerSeasonTeamRef:g.playerSeasonTeamRef?String(g.playerSeasonTeamRef):null,goalType:g.goalType,createdAt:g.createdAt?.toISOString()??entry.correctedAt.toISOString()})),penaltyShootout:entry.correctedResult.penaltyShootout?{...entry.correctedResult.penaltyShootout,kicks:entry.correctedResult.penaltyShootout.kicks.map(k=>({seasonTeamRef:String(k.seasonTeamRef),playerRef:k.playerRef?String(k.playerRef):null,result:k.result}))}:null,winnerSeasonTeamRef:entry.correctedResult.winnerSeasonTeamRef?String(entry.correctedResult.winnerSeasonTeamRef):null}})),penaltyShootout:m.penaltyShootout?{status:m.penaltyShootout.status,homeTeamScore:m.penaltyShootout.homeTeamScore,awayTeamScore:m.penaltyShootout.awayTeamScore,kicks:m.penaltyShootout.kicks.map(k=>({seasonTeamRef:String(k.seasonTeamRef),playerRef:k.playerRef?String(k.playerRef):null,result:k.result}))}:null,winnerSeasonTeamRef:this.mapTeam(m.winnerSeasonTeamRef),notes:m.notes,createdAt:m.createdAt.toISOString(),updatedAt:m.updatedAt.toISOString()};}
 private async getExisting(id:string):Promise<SeasonMatchEntity>{
  this.id(id,"match");
  const match=await this.repo.findById(id);
  if(!match)throw new AppError("Match not found",404,"MATCH_NOT_FOUND");
  const season=await this.repo.findSeason(String(match.seasonRef));
  if(!season)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  if(isSeasonReadOnly(season.status))throw new AppError("Completed and archived season match history is read-only",409,"SEASON_CLOSED");
  return match;
 }
 private id(value:string,label:string){if(!Types.ObjectId.isValid(value))throw new AppError("Invalid "+label+" ID",400,"INVALID_ID");}
}
