import { USE_MOCK_API } from "@/config/env";
import { seasonPreviewRepository } from "@/mocks/seasonRepository";
import { api, run } from "@/services/api";
import type { ApiResponse } from "@/types/api.types";
import type { AuctionLot, AuctionLotsQuery, AuctionLotStatus, AuctionSummary, NominatePlayerInput, Season, SeasonTeam, SeasonWrite, UpdateAuctionLotInput } from "@/types/season.types";

export function getSeasons() {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.getSeasons() : api.get<ApiResponse<Season[]>>("/seasons").then((r) => r.data));
}
export function createSeason(data: SeasonWrite) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.createSeason(data) : api.post<ApiResponse<Season>>("/seasons", data).then((r) => r.data));
}
export function updateSeason(id: string, data: Partial<SeasonWrite>) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.updateSeason(id, data) : api.patch<ApiResponse<Season>>("/seasons/" + id, data).then((r) => r.data));
}
export function deleteSeason(id: string) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.deleteSeason(id)
    : Promise.reject(new Error("Season deletion is not available in the current backend API.")));
}
export function registerSeasonTeams(id: string, teamIds: string[]) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.registerSeasonTeams(id, teamIds) : api.post<ApiResponse<SeasonTeam[]>>("/seasons/" + id + "/teams", { teamIds }).then((r) => r.data));
}
export function getSeasonTeams(id: string) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.getSeasonTeams(id) : api.get<ApiResponse<SeasonTeam[]>>("/seasons/" + id + "/teams").then((r) => r.data));
}
export function getAuctionSummary(seasonId: string) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.getAuctionSummary(seasonId) : api.get<ApiResponse<AuctionSummary>>("/auctions/summary", { params: { seasonId } }).then((r) => r.data));
}
export function getAuctionLots(query: AuctionLotsQuery) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.getAuctionLots(query) : api.get<ApiResponse<AuctionLot[]>>("/auctions", { params: query }).then((r) => r.data));
}
export function nominatePlayer(data: NominatePlayerInput) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.nominatePlayer(data) : api.post<ApiResponse<AuctionLot>>("/auctions/lots", data).then((r) => r.data));
}
export function sellAuctionLot(id: string, data: { seasonTeamId: string; purchasePrice: number; jerseyNo?: number | null }) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.sellAuctionLot(id, data) : api.patch<ApiResponse<AuctionLot>>("/auctions/lots/" + id + "/sell", data).then((r) => r.data));
}
export function updateAuctionLot(id: string, data: UpdateAuctionLotInput) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.updateAuctionLot(id, data)
    : api.patch<ApiResponse<AuctionLot>>("/auctions/lots/" + id, data).then((r) => r.data));
}

export function updateAuctionLotStatus(id: string, auctionStatus: AuctionLotStatus) {
  return updateAuctionLot(id, { auctionStatus });
}
