import type { SeasonStatus } from "../seasons/season.types.js";

/** Managers may be assigned or reassigned through the Active lifecycle stage. */
export const MANAGER_ASSIGNMENT_SEASON_STATUSES: SeasonStatus[] = ["draft", "upcoming", "active"];

export function canAssignSeasonTeamManagers(status: string): boolean {
  return MANAGER_ASSIGNMENT_SEASON_STATUSES.includes(status as SeasonStatus);
}

/** Group membership is frozen after activation or as soon as a fixture exists. */
export function canAssignSeasonTeamGroups(status: string, fixtureCount: number): boolean {
  return (status === "draft" || status === "upcoming") && fixtureCount === 0;
}
