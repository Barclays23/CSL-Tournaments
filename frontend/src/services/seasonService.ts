import { USE_MOCK_API } from "@/config/env";
import { seasonPreviewRepository } from "@/mocks/seasonRepository";
import { api, run } from "@/services/api";
import type { ApiResponse } from "@/types/api.types";
import type { AuctionLot, AuctionLotsQuery, AuctionLotStatus, AuctionSummary, NominatePlayerInput, Season, SeasonTeam, SeasonWrite, SeasonPatch, UpdateAuctionLotInput, SeasonStatus } from "@/types/season.types";

export function getSeasons() {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.getSeasons() : api.get<ApiResponse<Season[]>>("/seasons").then((r) => r.data));
}
export function createSeason(data: SeasonWrite) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.createSeason(data) : api.post<ApiResponse<Season>>("/seasons", data).then((r) => r.data));
}
export function updateSeason(id: string, data: SeasonPatch) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.updateSeason(id, data) : api.patch<ApiResponse<Season>>("/seasons/" + id, data).then((r) => r.data));
}
export function transitionSeason(id: string, status: Extract<SeasonStatus, "draft" | "upcoming" | "active">) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.transitionSeason(id, status) : api.patch<ApiResponse<Season>>("/seasons/" + id + "/lifecycle", { status }).then((r) => r.data));
}
export function completeSeason(id: string) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.completeSeason(id) : api.post<ApiResponse<Season>>("/seasons/" + id + "/complete").then((r) => r.data));
}
export function archiveSeason(id: string) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.archiveSeason(id) : api.post<ApiResponse<Season>>("/seasons/" + id + "/archive").then((r) => r.data));
}
export function deleteSeason(id: string) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.deleteSeason(id) : api.delete<ApiResponse<null>>("/seasons/" + id).then((r) => r.data));
}
export function registerSeasonTeams(id: string, teamIds: string[]) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.registerSeasonTeams(id, teamIds) : api.post<ApiResponse<SeasonTeam[]>>("/seasons/" + id + "/teams", { teamIds }).then((r) => r.data));
}
export function getSeasonTeams(id: string) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.getSeasonTeams(id) : api.get<ApiResponse<SeasonTeam[]>>("/seasons/" + id + "/teams").then((r) => r.data));
}
export function updateSeasonTeam(seasonId: string, id: string, data: { groupId?: string | null; managerIds?: string[] }) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.updateSeasonTeam(id, data) : api.patch<ApiResponse<SeasonTeam>>("/seasons/" + seasonId + "/teams/" + id, data).then((r) => r.data));
}
export function removeSeasonTeam(seasonId: string, id: string) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.removeSeasonTeam(seasonId, id) : api.delete<ApiResponse<null>>("/seasons/" + seasonId + "/teams/" + id).then((r) => r.data));
}
export function withdrawSeasonTeam(seasonId: string, id: string) {
  return run(() => USE_MOCK_API ? seasonPreviewRepository.withdrawSeasonTeam(seasonId, id) : api.post<ApiResponse<SeasonTeam>>("/seasons/" + seasonId + "/teams/" + id + "/withdraw").then((r) => r.data));
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
  return run(() => USE_MOCK_API ? seasonPreviewRepository.updateAuctionLot(id, data) : api.patch<ApiResponse<AuctionLot>>("/auctions/lots/" + id, data).then((r) => r.data));
}
export function updateAuctionLotStatus(id: string, auctionStatus: AuctionLotStatus) {
  return updateAuctionLot(id, { auctionStatus });
}
