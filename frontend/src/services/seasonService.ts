import {api,run} from "@/services/api";
import type {ApiResponse} from "@/types/api.types";
import type {AuctionSummary,Season,SeasonWrite} from "@/types/season.types";
export function getSeasons(){return run(()=>api.get<ApiResponse<Season[]>>("/seasons").then(r=>r.data));}
export function createSeason(data:SeasonWrite){return run(()=>api.post<ApiResponse<Season>>("/seasons",data).then(r=>r.data));}
export function getAuctionSummary(seasonId:string){return run(()=>api.get<ApiResponse<AuctionSummary>>("/auction-lots",{params:{seasonId}}).then(r=>r.data));}
export function nominatePlayer(data:{seasonId:string;playerId:string;playerPosition:"goalkeeper"|"defender"|"midfielder"|"forward";isIconPlayer:boolean;isGoalkeeper:boolean}){return run(()=>api.post<ApiResponse<unknown>>("/auction-lots",data).then(r=>r.data));}
export function sellAuctionLot(id:string,data:{seasonTeamId:string;purchasePrice:number;jerseyNo?:number|null}){return run(()=>api.patch<ApiResponse<unknown>>(`/auction-lots/${id}/sell`,data).then(r=>r.data));}
export function updateAuctionLotStatus(id:string,auctionStatus:"unsold"|"withdrawn"){return run(()=>api.patch<ApiResponse<unknown>>(`/auction-lots/${id}/status`,{auctionStatus}).then(r=>r.data));}
