import { USE_MOCK_API } from "@/config/env";
import { seasonPreviewRepository } from "@/mocks/seasonRepository";
import { api, run } from "@/services/api";
import type { ApiResponse } from "@/types/api.types";
import type {
  PlayerHistory,
  SeasonStandings,
  SeasonTeamDashboard,
  SeasonTopScorers,
} from "@/types/seasonStatistics.types";

export function getSeasonTeamDashboard(teamId: string, seasonId: string) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.getSeasonTeamDashboard(teamId, seasonId)
    : api.get<ApiResponse<SeasonTeamDashboard>>("/teams/" + teamId + "/dashboard", { params: { seasonId } }).then((r) => r.data));
}

export function getPlayerHistory(playerId: string) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.getPlayerHistory(playerId)
    : api.get<ApiResponse<PlayerHistory>>("/players/" + playerId + "/history").then((r) => r.data));
}

export function getSeasonStandings(seasonId: string) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.getSeasonStandings(seasonId)
    : api.get<ApiResponse<SeasonStandings>>("/seasons/" + seasonId + "/standings").then((r) => r.data));
}

export function getSeasonTopScorers(seasonId: string) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.getSeasonTopScorers(seasonId)
    : api.get<ApiResponse<SeasonTopScorers>>("/seasons/" + seasonId + "/top-scorers").then((r) => r.data));
}
