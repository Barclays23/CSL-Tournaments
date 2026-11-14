import {api,run} from "@/services/api";
import type {ApiResponse} from "@/types/api.types";
import type {SeasonTeamDashboard,PlayerHistory} from "@/types/seasonStatistics.types";
export function getSeasonTeamDashboard(teamId:string,seasonId:string){return run(()=>api.get<ApiResponse<SeasonTeamDashboard>>("/teams/"+teamId+"/dashboard",{params:{seasonId}}).then(r=>r.data));}
export function getPlayerHistory(playerId:string){return run(()=>api.get<ApiResponse<PlayerHistory>>("/players/"+playerId+"/history").then(r=>r.data));}
export function getSeasonStandings(seasonId:string){return run(()=>api.get<ApiResponse<unknown>>("/seasons/"+seasonId+"/standings").then(r=>r.data));}
export function getSeasonTopScorers(seasonId:string){return run(()=>api.get<ApiResponse<unknown>>("/seasons/"+seasonId+"/top-scorers").then(r=>r.data));}
