import type { SeasonStatus } from "@/types/season.types";

/** Keep manager assignment available until the season reaches a read-only state. */
export function canEditSeasonTeamManagers(status: SeasonStatus): boolean {
  return status === "draft" || status === "upcoming" || status === "active";
}

export interface SeasonTeamManagerOption {
  _id: string;
  status: "active" | "inactive";
}

/** Show already-assigned managers (including inactive ones) so they can be removed. */
export function getSeasonTeamManagerOptions<T extends SeasonTeamManagerOption>(
  managers: T[],
  currentTeamManagerIds: string[],
  managersAssignedElsewhere: string[],
): T[] {
  const currentAssignments = new Set(currentTeamManagerIds);
  const otherAssignments = new Set(managersAssignedElsewhere);
  return managers.filter((manager) =>
    currentAssignments.has(manager._id) ||
    (manager.status === "active" && !otherAssignments.has(manager._id)),
  );
}

/** Inactive managers can be removed from a team, but cannot be newly assigned. */
export function canToggleSeasonTeamManagerAssignment(
  seasonStatus: SeasonStatus,
  managerStatus: "active" | "inactive",
  currentlyAssigned: boolean,
): boolean {
  return canEditSeasonTeamManagers(seasonStatus) && (currentlyAssigned || managerStatus === "active");
}
