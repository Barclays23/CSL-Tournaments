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

export function createSeasonGroup(seasonId: string, data: { groupName: string; displayOrder?: number }) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.createSeasonGroup(seasonId, data)
    : api.post<ApiResponse<SeasonGroup>>(`/seasons/${seasonId}/groups`, data).then((response) => response.data),
  );
}
export function updateSeasonGroup(seasonId: string, groupId: string, data: { groupName?: string; displayOrder?: number }) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.updateSeasonGroup(seasonId, groupId, data)
    : api.patch<ApiResponse<SeasonGroup>>(`/seasons/${seasonId}/groups/${groupId}`, data).then((response) => response.data),
  );
}
export function deleteSeasonGroup(seasonId: string, groupId: string) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.deleteSeasonGroup(seasonId, groupId)
    : api.delete<ApiResponse<null>>(`/seasons/${seasonId}/groups/${groupId}`).then((response) => response.data),
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

export function updateSeasonMatchResolution(seasonId: string, matchId: string, data: { status: "cancelled" | "abandoned"; resolutionReason: string }) {
  return run(() =>
    USE_MOCK_API
      ? seasonPreviewRepository.updateSeasonMatchResolution(seasonId, matchId, data)
      : api.patch<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}`, data).then((response) => response.data),
  );
}

export function createSeasonMatch(seasonId: string, data: SeasonMatchWrite) {
  return run(() =>
    USE_MOCK_API
      ? seasonPreviewRepository.createSeasonMatch(seasonId, data)
      : api.post<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches`, data).then((response) => response.data),
  );
}

export type SeasonGoalWrite = {
  scoringSeasonTeamRef: string;
  scorerPlayerRef?: string | null;
  goalType: "normal" | "own_goal";
};

export function addSeasonMatchGoal(seasonId: string, matchId: string, data: SeasonGoalWrite) {
  return run(() =>
    USE_MOCK_API
      ? seasonPreviewRepository.addSeasonMatchGoal(seasonId, matchId, data)
      : api.post<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/goals`, data).then((response) => response.data),
  );
}

export function updateSeasonMatchGoal(seasonId: string, matchId: string, goalId: string, data: SeasonGoalWrite) {
  return run(() =>
    USE_MOCK_API
      ? seasonPreviewRepository.updateSeasonMatchGoal(seasonId, matchId, goalId, data)
      : api.patch<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/goals/${goalId}`, data).then((response) => response.data),
  );
}

export function deleteSeasonMatchGoal(seasonId: string, matchId: string, goalId: string) {
  return run(() =>
    USE_MOCK_API
      ? seasonPreviewRepository.deleteSeasonMatchGoal(seasonId, matchId, goalId)
      : api.delete<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/goals/${goalId}`).then((response) => response.data),
  );
}
