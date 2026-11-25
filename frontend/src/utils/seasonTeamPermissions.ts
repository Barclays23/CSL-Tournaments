import type { SeasonStatus } from "@/types/season.types";

/** Keep manager assignment available until the season reaches a read-only state. */
export function canEditSeasonTeamManagers(status: SeasonStatus): boolean {
  return status === "draft" || status === "upcoming" || status === "active";
}
