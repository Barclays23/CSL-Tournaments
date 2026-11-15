import { USE_MOCK_API } from "@/config/env";
import { seasonPreviewRepository } from "@/mocks/seasonRepository";
import { api, run } from "@/services/api";
import type { ApiResponse, Pagination } from "@/types/api.types";
import type { SeasonGroup, SeasonMatch, SeasonMatchQuery, SeasonMatchWrite } from "@/types/seasonMatch.types";

export function getSeasonGroups(seasonId: string) {
  return run(() =>
    USE_MOCK_API
      ? seasonPreviewRepository.getSeasonGroups(seasonId)
      : api.get<ApiResponse<SeasonGroup[]>>(`/seasons/${seasonId}/groups`).then((response) => response.data),
  );
}

export function getSeasonMatches(seasonId: string, params: SeasonMatchQuery = {}) {
  return run(async () => {
    if (USE_MOCK_API) return seasonPreviewRepository.getSeasonMatches(seasonId, params);
    const response = await api.get<ApiResponse<{ items: SeasonMatch[]; pagination: Pagination }>>(
      `/seasons/${seasonId}/matches`,
      { params },
    );
    return {
      ...response.data,
      data: response.data.data.items,
      pagination: response.data.data.pagination,
    };
  });
}

export function getSeasonMatchById(seasonId: string, matchId: string) {
  return run(() =>
    USE_MOCK_API
      ? seasonPreviewRepository.getSeasonMatch(seasonId, matchId)
      : api.get<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}`).then((response) => response.data),
  );
}

export function createSeasonMatch(seasonId: string, data: SeasonMatchWrite) {
  return run(() =>
    USE_MOCK_API
      ? seasonPreviewRepository.createSeasonMatch(seasonId, data)
      : api.post<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches`, data).then((response) => response.data),
  );
}
