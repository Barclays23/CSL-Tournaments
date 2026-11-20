import {Types} from "mongoose";
import {AppError} from "../../shared/errors/appError.js";
import type {SeasonStatisticsRepository,PopulatedSeasonTeam,PopulatedAuctionLot} from "./seasonStatistics.repository.js";
import type {ISeasonStatisticsService} from "./seasonStatistics.interfaces.js";
import type {SeasonStandingsDto,SeasonGroupStandingDto,SeasonStandingRowDto,SeasonTeamBriefDto,SeasonTopScorersDto,SeasonTopScorerDto,SeasonTeamDashboardDto,SeasonFixtureDto,PlayerHistoryDto,PlayerAuctionHistoryDto,SeasonBriefDto} from "./seasonStatistics.dto.js";
import type {PopulatedSeasonMatch,SeasonMatchEntity} from "../matches/seasonMatch.types.js";

interface Standing{team:SeasonTeamBriefDto;played:number;won:number;drawn:number;lost:number;goalsScored:number;goalsConceded:number;goalDifference:number;points:number;}
interface TeamTotals{played:number;won:number;drawn:number;lost:number;goalsScored:number;goalsConceded:number;cleanSheets:number;}
export class SeasonStatisticsService implements ISeasonStatisticsService{
 constructor(private readonly repo:SeasonStatisticsRepository){}
 async getStandings(seasonId:string):Promise<SeasonStandingsDto>{
  this.id(seasonId,"season");const season=await this.requireSeason(seasonId);
  const [teams,groups,matches]=await Promise.all([this.repo.findSeasonTeams(seasonId),this.repo.findGroups(seasonId),this.repo.findGroupStandingsMatches(seasonId)]);
  const standings=new Map<string,Standing>();
  for(const st of teams)standings.set(String(st._id),{team:this.teamBrief(st),played:0,won:0,drawn:0,lost:0,goalsScored:0,goalsConceded:0,goalDifference:0,points:0});
  for(const match of matches){
   const home=this.refId(match.homeSeasonTeamRef),away=this.refId(match.awaySeasonTeamRef),h=standings.get(home),a=standings.get(away);if(!h||!a)continue;
   const hg=this.score(match,home),ag=this.score(match,away);h.played++;a.played++;h.goalsScored+=hg;h.goalsConceded+=ag;a.goalsScored+=ag;a.goalsConceded+=hg;
   if(hg>ag){h.won++;a.lost++;h.points+=season.pointsRules.win;a.points+=season.pointsRules.loss;}
   else if(ag>hg){a.won++;h.lost++;a.points+=season.pointsRules.win;h.points+=season.pointsRules.loss;}
   else{h.drawn++;a.drawn++;h.points+=season.pointsRules.draw;a.points+=season.pointsRules.draw;}
  }
  const groupNames=new Map<string,string>(groups.map(g=>[String(g._id),g.groupName]));
  const buckets=new Map<string,Standing[]>();
  for(const row of standings.values()){row.goalDifference=row.goalsScored-row.goalsConceded;const key=row.team.groupRef??"ungrouped";const list=buckets.get(key)??[];list.push(row);buckets.set(key,list);}
  const result:SeasonGroupStandingDto[]=[...buckets.entries()].map(([key,rows])=>({groupRef:key==="ungrouped"?null:key,groupName:key==="ungrouped"?"Ungrouped":groupNames.get(key)??"Ungrouped",rows:[...rows].sort((a,b)=>this.compare(a,b,season.standingsTieBreakers)).map((r,i):SeasonStandingRowDto=>({...r,position:i+1,qualified:i<2}))})).sort((a,b)=>a.groupName.localeCompare(b.groupName));
  return {season:this.seasonBrief(season),groups:result};
 }
 async getTopScorers(seasonId:string):Promise<SeasonTopScorersDto>{
  this.id(seasonId,"season");const season=await this.requireSeason(seasonId);const [matches,lots]=await Promise.all([this.repo.findMatchesForTopScorers(seasonId),this.repo.findSoldLots(seasonId)]);
  const goalCounts=new Map<string,number>();
  const goalTeamByPlayer=new Map<string,SeasonTeamBriefDto>();
  for(const match of matches)for(const goal of match.goals){
   if(goal.goalType!=="normal"||!goal.scorerPlayerRef)continue;
   const id=this.refId(goal.scorerPlayerRef);
   goalCounts.set(id,(goalCounts.get(id)??0)+1);
   const goalTeam=goal.playerSeasonTeamRef;
   if(goalTeam&&!(goalTeam instanceof Types.ObjectId)){
    const teamRef=goalTeam.teamRef;
    const team=teamRef&&!(teamRef instanceof Types.ObjectId)?teamRef:null;
    if(team)goalTeamByPlayer.set(id,{
     _id:String(goalTeam._id),teamId:String(team._id),displayName:goalTeam.displayName,
     shortName:team.shortName,logo:goalTeam.logoSnapshot,groupRef:null,groupName:null
    });
   }
  }
  const players=await this.repo.findPlayersByIds([...goalCounts.keys()]);
  const playerById=new Map(players.map(p=>[String(p._id),p]));
  const lotByPlayer=new Map(lots.map(l=>[this.refId(l.playerRef),l]));
  const items:SeasonTopScorerDto[]=[...goalCounts.entries()].flatMap(([id,goals])=>{
   const player=playerById.get(id);if(!player)return [];
   const lot=lotByPlayer.get(id);
   const lotTeam=lot?.seasonTeamRef&&!(lot.seasonTeamRef instanceof Types.ObjectId)
    ?this.teamBrief(lot.seasonTeamRef as PopulatedSeasonTeam):null;
   const team=goalTeamByPlayer.get(id)??lotTeam;
   return [{rank:0,player:{_id:id,name:player.name,profilePic:player.profilePic},team,position:lot?.playerPosition??null,jerseyNo:lot?.jerseyNo??null,goals}];
  }).sort((a,b)=>b.goals-a.goals||a.player.name.localeCompare(b.player.name));
  let previous=-1,rank=0;items.forEach((row,index)=>{if(row.goals!==previous){rank=index+1;previous=row.goals;}row.rank=rank;});
  return {season:this.seasonBrief(season),items};
 }
 async getTeamDashboard(teamId:string,seasonId:string):Promise<SeasonTeamDashboardDto>{
  this.id(teamId,"team");this.id(seasonId,"season");const [season,team,participation]=await Promise.all([this.requireSeason(seasonId),this.repo.findTeam(teamId),this.repo.findSeasonTeam(seasonId,teamId)]);
  if(!team||team.status!=="active")throw new AppError("Team not found",404,"TEAM_NOT_FOUND");
  const teamInfo={_id:String(team._id),name:team.name,shortName:team.shortName,logo:team.logo};
  if(!participation)return {participates:false,season:this.seasonBrief(season),team:teamInfo,seasonTeam:null,managers:[],squad:[],stats:{played:0,won:0,drawn:0,lost:0,goalsScored:0,goalsConceded:0,goalDifference:0,cleanSheets:0,topScorer:null},recentFixtures:[],upcomingFixtures:[]};
  const [lots,matches]=await Promise.all([this.repo.findSquadLots(seasonId),this.repo.findMatchesForSeasonTeam(seasonId,String(participation._id))]);
  const teamLots=lots.filter(l=>l.seasonTeamRef&&this.refId(l.seasonTeamRef)===String(participation._id));
  const squad=teamLots.map(l=>({player:{_id:String(l.playerRef._id),name:l.playerRef.name,profilePic:l.playerRef.profilePic},position:l.playerPosition,jerseyNo:l.jerseyNo,purchasePrice:l.purchasePrice,isIconPlayer:l.isIconPlayer,isGoalkeeper:l.isGoalkeeper,auctionStatus:l.auctionStatus as "sold"|"withdrawn"}));
  const stats:TeamTotals={played:0,won:0,drawn:0,lost:0,goalsScored:0,goalsConceded:0,cleanSheets:0};const playerGoals=new Map<string,number>();
  const signedPlayers=new Map(teamLots.map(l=>[String(l.playerRef._id),l.playerRef]));
  for(const match of matches.filter(m=>m.status==="completed")){
   const id=String(participation._id),other=this.refId(match.homeSeasonTeamRef)===id?this.refId(match.awaySeasonTeamRef):this.refId(match.homeSeasonTeamRef);
   const scored=this.score(match,id),conceded=this.score(match,other);stats.played++;stats.goalsScored+=scored;stats.goalsConceded+=conceded;if(conceded===0)stats.cleanSheets++;
   if(scored>conceded){stats.won++;}
   else if(scored<conceded){stats.lost++;}
   else{stats.drawn++;}
   for(const goal of match.goals){if(goal.goalType==="normal"&&goal.scorerPlayerRef&&goal.playerSeasonTeamRef&&this.refId(goal.playerSeasonTeamRef)===id){const pid=this.refId(goal.scorerPlayerRef);playerGoals.set(pid,(playerGoals.get(pid)??0)+1);}}
  }
  const leader=[...playerGoals.entries()].sort((a,b)=>b[1]-a[1]||(signedPlayers.get(a[0])?.name??"").localeCompare(signedPlayers.get(b[0])?.name??""))[0];
  const topScorer=leader&&signedPlayers.has(leader[0])?{player:{_id:leader[0],name:signedPlayers.get(leader[0])!.name,profilePic:signedPlayers.get(leader[0])!.profilePic},goals:leader[1]}:null;
  const fixtures=matches.map(m=>this.fixture(m)).sort((a,b)=>a.kickoffAt.localeCompare(b.kickoffAt));const now=Date.now();
  const recentFixtures=fixtures.filter(f=>f.status==="completed").sort((a,b)=>b.kickoffAt.localeCompare(a.kickoffAt)).slice(0,5);
  const upcomingFixtures=fixtures.filter(f=>["scheduled","live"].includes(f.status)&&new Date(f.kickoffAt).getTime()>=now).slice(0,5);
  return {participates:true,season:this.seasonBrief(season),team:teamInfo,seasonTeam:this.teamBrief(participation),managers:participation.managerRefs.flatMap(manager=>manager instanceof Types.ObjectId?[]:[{_id:String(manager._id),name:manager.name,role:manager.role,profilePic:manager.profilePic}]),squad,stats:{...stats,goalDifference:stats.goalsScored-stats.goalsConceded,topScorer},recentFixtures,upcomingFixtures};
 }
 async getPlayerHistory(playerId:string):Promise<PlayerHistoryDto>{
  this.id(playerId,"player");const player=await this.repo.findPlayer(playerId);if(!player)throw new AppError("Player not found",404,"PLAYER_NOT_FOUND");
  const [lots,activeSeason,matches]=await Promise.all([this.repo.findLotsForPlayer(playerId),this.repo.findActiveSeason(),this.repo.findCompletedMatchesForPlayer(playerId)]);
  const current=activeSeason?lots.find(l=>String(l.seasonRef._id)===String(activeSeason._id)&&l.auctionStatus==="sold"):undefined;
  const history=lots.map(l=>this.auctionHistory(l));const currentTeam=current?.seasonTeamRef&&!(current.seasonTeamRef instanceof Types.ObjectId)?current.seasonTeamRef as PopulatedSeasonTeam:null;
  const goalsBySeason=new Map<string,{season:SeasonBriefDto;goals:number}>();
  for(const match of matches){const season=(match as any).seasonRef;if(!season)continue;for(const goal of match.goals){if(goal.goalType!=="normal"||!goal.scorerPlayerRef||this.refId(goal.scorerPlayerRef)!==playerId)continue;const key=String(season._id);const entry=goalsBySeason.get(key)??{season:this.seasonBrief(season),goals:0};entry.goals++;goalsBySeason.set(key,entry);}}
  const goalHistory=[...goalsBySeason.values()].sort((a,b)=>a.season.year-b.season.year);
  return {player:{_id:String(player._id),name:player.name,profilePic:player.profilePic,status:player.status},currentSeason:activeSeason?this.seasonBrief(activeSeason):null,currentSeasonTeam:current&&currentTeam?{seasonTeamId:String(currentTeam._id),team:this.teamBrief(currentTeam),position:current.playerPosition,jerseyNo:current.jerseyNo,purchasePrice:current.purchasePrice,isIconPlayer:current.isIconPlayer,isGoalkeeper:current.isGoalkeeper}:null,auctionHistory:history,teamMovementHistory:history.filter(h=>h.status==="sold"||h.status==="withdrawn"),goalHistory,totalNormalGoals:goalHistory.reduce((sum,g)=>sum+g.goals,0)};
 }
 private auctionHistory(l:PopulatedAuctionLot){const st=l.seasonTeamRef&&!(l.seasonTeamRef instanceof Types.ObjectId)?l.seasonTeamRef as PopulatedSeasonTeam:null;return {season:this.seasonBrief(l.seasonRef),status:l.auctionStatus,team:st?this.teamBrief(st):null,position:l.playerPosition,jerseyNo:l.jerseyNo,purchasePrice:l.purchasePrice,isIconPlayer:l.isIconPlayer,isGoalkeeper:l.isGoalkeeper,soldAt:l.soldAt?.toISOString()??null};}
 private compare(a:Standing,b:Standing,keys:readonly string[]):number{for(const key of keys){let d=0;if(key==="points")d=b.points-a.points;else if(key==="goalDifference")d=b.goalDifference-a.goalDifference;else if(key==="goalsScored")d=b.goalsScored-a.goalsScored;else if(key==="teamNameAsc")d=a.team.displayName.localeCompare(b.team.displayName);if(d)return d;}return a.team.displayName.localeCompare(b.team.displayName);}
 private score(match:PopulatedSeasonMatch,teamId:string):number{return match.goals.filter(g=>this.refId(g.scoringSeasonTeamRef)===teamId).length;}
 private fixture(m:PopulatedSeasonMatch):SeasonFixtureDto{const home=this.teamBrief(m.homeSeasonTeamRef as any),away=this.teamBrief(m.awaySeasonTeamRef as any);return {_id:String(m._id),matchNumber:m.matchNumber,stage:m.stage,kickoffAt:m.kickoffAt.toISOString(),status:m.status,home,away,homeScore:this.score(m,String((m.homeSeasonTeamRef as any)._id)),awayScore:this.score(m,String((m.awaySeasonTeamRef as any)._id)),winnerSeasonTeamRef:m.winnerSeasonTeamRef?this.refId(m.winnerSeasonTeamRef):null,penaltyShootout:m.penaltyShootout?{homeTeamScore:m.penaltyShootout.homeTeamScore,awayTeamScore:m.penaltyShootout.awayTeamScore,status:m.penaltyShootout.status}:null};}
 private teamBrief(st:PopulatedSeasonTeam|any):SeasonTeamBriefDto{return {_id:String(st._id),teamId:String(st.teamRef?._id??st.teamRef),displayName:st.teamRef?.name??st.displayName,shortName:st.teamRef?.shortName??null,logo:st.teamRef?.logo??st.logoSnapshot??null,groupRef:st.groupRef?String(st.groupRef._id??st.groupRef):null,groupName:st.groupRef?.groupName??null};}
 private seasonBrief(s:any):SeasonBriefDto{return {_id:String(s._id),name:s.name,seasonNumber:s.seasonNumber,year:s.year,status:s.status};}
 private async requireSeason(id:string):Promise<NonNullable<Awaited<ReturnType<SeasonStatisticsRepository["findSeason"]>>> & {
  pointsRules: NonNullable<NonNullable<Awaited<ReturnType<SeasonStatisticsRepository["findSeason"]>>>["pointsRules"]>;
  standingsTieBreakers: NonNullable<NonNullable<Awaited<ReturnType<SeasonStatisticsRepository["findSeason"]>>>["standingsTieBreakers"]>;
 }>{
  const s=await this.repo.findSeason(id);
  if(!s)throw new AppError("Season not found",404,"SEASON_NOT_FOUND");
  if(!s.pointsRules||!s.standingsTieBreakers)throw new AppError("Standings rules are unavailable for this historical season",409,"SEASON_RULES_UNAVAILABLE");
  return s as NonNullable<Awaited<ReturnType<SeasonStatisticsRepository["findSeason"]>>> & {
   pointsRules: NonNullable<NonNullable<Awaited<ReturnType<SeasonStatisticsRepository["findSeason"]>>>["pointsRules"]>;
   standingsTieBreakers: NonNullable<NonNullable<Awaited<ReturnType<SeasonStatisticsRepository["findSeason"]>>>["standingsTieBreakers"]>;
  };
 }
 private refId(ref:any):string{return String(ref?._id??ref);}
 private id(value:string,label:string){if(!Types.ObjectId.isValid(value))throw new AppError("Invalid "+label+" ID",400,"INVALID_ID");}
}
