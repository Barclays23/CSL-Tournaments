import { USE_MOCK_API } from "@/config/env";
import { seasonPreviewRepository } from "@/mocks/seasonRepository";
import { api, run } from "@/services/api";
import type { ApiResponse, Pagination } from "@/types/api.types";
import type { SeasonGroup, SeasonMatch, SeasonMatchQuery, SeasonMatchStatus, SeasonMatchFixtureUpdate, SeasonMatchCreateWrite, SeasonMatchCorrectionWrite, SeasonMatchCardType, MatchEventTimingWrite } from "@/types/seasonMatch.types";

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
  const action = data.status === "cancelled" ? "cancel" : "abandon";
  return changeSeasonMatchStatus(seasonId, matchId, { action, reason: data.resolutionReason });
}

export function updateSeasonMatch(seasonId: string, matchId: string, data: SeasonMatchFixtureUpdate) {
  return run(() =>
    USE_MOCK_API
      ? seasonPreviewRepository.updateSeasonMatch(seasonId, matchId, data)
      : api.patch<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}`, data).then((response) => response.data),
  );
}

export function createSeasonMatch(seasonId: string, data: SeasonMatchCreateWrite) {
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
  reason?: string;
} & MatchEventTimingWrite;

export function deleteSeasonMatch(seasonId: string, matchId: string) {
  return run(() =>
    USE_MOCK_API
      ? seasonPreviewRepository.deleteSeasonMatch(seasonId, matchId)
      : api.delete<ApiResponse<null>>(`/seasons/${seasonId}/matches/${matchId}`).then((response) => response.data),
  );
}

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

export function deleteSeasonMatchGoal(seasonId: string, matchId: string, goalId: string, reason?: string) {
  return run(() =>
    USE_MOCK_API
      ? seasonPreviewRepository.deleteSeasonMatchGoal(seasonId, matchId, goalId, reason)
      : api.delete<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/goals/${goalId}`, { data: reason ? { reason } : {} }).then((response) => response.data),
  );
}

export interface SeasonMatchCardWrite extends MatchEventTimingWrite { seasonTeamRef: string; playerRef: string; cardType: SeasonMatchCardType; reason?: string; }

export function addSeasonMatchCard(seasonId: string, matchId: string, data: SeasonMatchCardWrite) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.addSeasonMatchCard(seasonId, matchId, data)
    : api.post<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/cards`, data).then((response) => response.data));
}
export function updateSeasonMatchCard(seasonId: string, matchId: string, cardId: string, data: SeasonMatchCardWrite) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.updateSeasonMatchCard(seasonId, matchId, cardId, data)
    : api.patch<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/cards/${cardId}`, data).then((response) => response.data));
}
export function deleteSeasonMatchCard(seasonId: string, matchId: string, cardId: string, reason?: string) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.deleteSeasonMatchCard(seasonId, matchId, cardId, reason)
    : api.delete<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/cards/${cardId}`, { data: reason ? { reason } : {} }).then((response) => response.data));
}

export function correctCompletedSeasonMatch(seasonId: string, matchId: string, data: SeasonMatchCorrectionWrite) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.correctCompletedSeasonMatch(seasonId, matchId, data)
    : api.post<ApiResponse<SeasonMatch>>(
        `/seasons/${seasonId}/matches/${matchId}/corrections`,
        data,
      ).then((response) => response.data));
}

export interface SeasonMatchStatusWrite {
  status: SeasonMatchStatus;
  statusReason?: string;
  resolutionReason?: string;
}

export interface SeasonMatchRescheduleWrite {
  kickoffAt: string;
  reason?: string;
}

/**
 * Keep match lifecycle operations on the same data/authentication adapter as
 * the rest of the application. Mock mode must never fall through to the real
 * backend, where the browser's mock session cannot authenticate.
 */
export function updateSeasonMatchStatus(
  seasonId: string,
  matchId: string,
  data: SeasonMatchStatusWrite,
) {
  const reason = data.statusReason?.trim() || data.resolutionReason?.trim() || "";
  switch (data.status) {
    case "postponed":
      if (reason.length < 3) return Promise.reject(new Error("A postponement reason is required."));
      return changeSeasonMatchStatus(seasonId, matchId, { action: "postpone", reason });
    case "cancelled":
      if (reason.length < 3) return Promise.reject(new Error("A cancellation reason is required."));
      return changeSeasonMatchStatus(seasonId, matchId, { action: "cancel", reason });
    case "abandoned":
      if (reason.length < 3) return Promise.reject(new Error("An abandonment reason is required."));
      return changeSeasonMatchStatus(seasonId, matchId, { action: "abandon", reason });
    case "live":
      return changeSeasonMatchStatus(seasonId, matchId, { action: "resume" });
    case "completed":
      return completeSeasonMatch(seasonId, matchId);
    default:
      return Promise.reject(new Error("Use the dedicated reschedule operation to return a postponed fixture to Scheduled."));
  }
}

export function rescheduleSeasonMatch(
  seasonId: string,
  matchId: string,
  data: SeasonMatchRescheduleWrite,
) {
  return run(() =>
    USE_MOCK_API
      ? seasonPreviewRepository.rescheduleSeasonMatch(seasonId, matchId, data)
      : api.patch<ApiResponse<SeasonMatch>>(
          `/seasons/${seasonId}/matches/${matchId}/reschedule`,
          data,
        ).then((response) => response.data),
  );
}


export function startSeasonMatch(seasonId: string, matchId: string) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.startSeasonMatch(seasonId, matchId)
    : api.post<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/start`).then((response) => response.data));
}

export function pauseSeasonMatchClock(seasonId: string, matchId: string) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.pauseSeasonMatchClock(seasonId, matchId)
    : api.post<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/clock/pause`).then((response) => response.data));
}

export function resumeSeasonMatchClock(seasonId: string, matchId: string) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.resumeSeasonMatchClock(seasonId, matchId)
    : api.post<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/clock/resume`).then((response) => response.data));
}

export function transitionSeasonMatchPhase(seasonId: string, matchId: string, action: import("@/types/seasonMatch.types").MatchPhaseAction) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.transitionSeasonMatchPhase(seasonId, matchId, action)
    : api.post<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/phase-transition`, { action }).then((response) => response.data));
}

export function completeSeasonMatch(seasonId: string, matchId: string) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.completeSeasonMatch(seasonId, matchId)
    : api.post<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/complete`).then((response) => response.data));
}

export function changeSeasonMatchStatus(seasonId: string, matchId: string, action: import("@/types/seasonMatch.types").MatchStatusAction) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.changeSeasonMatchStatus(seasonId, matchId, action)
    : api.post<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/status`, action).then((response) => response.data));
}

export function updateSeasonMatchDecidingRules(
  seasonId: string,
  matchId: string,
  decidingRules: import("@/types/seasonMatch.types").MatchDecidingRules,
  reason?: string,
) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.updateSeasonMatchDecidingRules(seasonId, matchId, { decidingRules, reason })
    : api.patch<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/deciding-rules`, { decidingRules, ...(reason ? { reason } : {}) }).then((response) => response.data));
}

export function updateSeasonMatchShootout(seasonId: string, matchId: string, value: import("@/types/seasonMatch.types").MatchShootoutWrite) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.updateSeasonMatchShootout(seasonId, matchId, value)
    : api.patch<ApiResponse<SeasonMatch>>(`/seasons/${seasonId}/matches/${matchId}/shootout`, value).then((response) => response.data));
}


export function correctSeasonMatchActualKickoff(
  seasonId: string,
  matchId: string,
  data: import("@/types/seasonMatch.types").ActualKickoffCorrectionWrite,
) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.correctSeasonMatchActualKickoff(seasonId, matchId, data)
    : api.patch<ApiResponse<SeasonMatch>>(
        `/seasons/${seasonId}/matches/${matchId}/timing/actual-kickoff`,
        data,
      ).then((response) => response.data));
}

export function correctSeasonMatchClock(
  seasonId: string,
  matchId: string,
  data: import("@/types/seasonMatch.types").MatchClockCorrectionWrite,
) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.correctSeasonMatchClock(seasonId, matchId, data)
    : api.patch<ApiResponse<SeasonMatch>>(
        `/seasons/${seasonId}/matches/${matchId}/timing/clock`,
        data,
      ).then((response) => response.data));
}

export function correctSeasonMatchPhase(
  seasonId: string,
  matchId: string,
  data: import("@/types/seasonMatch.types").MatchPhaseCorrectionWrite,
) {
  return run(() => USE_MOCK_API
    ? seasonPreviewRepository.correctSeasonMatchPhase(seasonId, matchId, data)
    : api.patch<ApiResponse<SeasonMatch>>(
        `/seasons/${seasonId}/matches/${matchId}/phase/correction`,
        data,
      ).then((response) => response.data));
}
