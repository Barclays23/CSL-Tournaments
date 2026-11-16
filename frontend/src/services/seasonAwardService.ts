import { USE_MOCK_API } from "@/config/env";
import { api, run } from "@/services/api";
import type { ApiResponse } from "@/types/api.types";
import type { SeasonAward, SeasonAwardInput } from "@/types/seasonAward.types";
export function getSeasonAwards(seasonId:string) {
  return run(() => USE_MOCK_API
    ? Promise.resolve({success:true,message:"No preview awards",data:[]} as ApiResponse<SeasonAward[]>)
    : api.get<ApiResponse<SeasonAward[]>>("/seasons/"+seasonId+"/awards").then(r=>r.data));
}
export function createSeasonAward(seasonId:string,data:SeasonAwardInput) {
  return run(() => USE_MOCK_API
    ? Promise.reject(new Error("Season awards require the real API; disable mock mode to save awards."))
    : api.post<ApiResponse<SeasonAward>>("/seasons/"+seasonId+"/awards",data).then(r=>r.data));
}
export function updateSeasonAward(seasonId:string,awardId:string,data:Partial<SeasonAwardInput>) {
  return run(() => USE_MOCK_API
    ? Promise.reject(new Error("Season awards require the real API; disable mock mode to save awards."))
    : api.patch<ApiResponse<SeasonAward>>("/seasons/"+seasonId+"/awards/"+awardId,data).then(r=>r.data));
}
export function deleteSeasonAward(seasonId:string,awardId:string) {
  return run(() => USE_MOCK_API
    ? Promise.reject(new Error("Season awards require the real API; disable mock mode to save awards."))
    : api.delete<ApiResponse<null>>("/seasons/"+seasonId+"/awards/"+awardId).then(r=>r.data));
}
