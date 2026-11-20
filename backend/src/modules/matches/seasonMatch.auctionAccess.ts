import type { UpdateSeasonMatchDto } from "./seasonMatch.dto.js";

const FIXTURE_DETAIL_FIELDS = [
  "matchNumber",
  "roundNumber",
  "stage",
  "groupRef",
  "kickoffAt",
  "venueRef",
  "homeSeasonTeamRef",
  "awaySeasonTeamRef",
  "notes",
] as const;

/** Only changes to fixture identity, participants or scheduling require a completed auction. */
export function requiresAuctionForFixtureMutation(input: Partial<UpdateSeasonMatchDto>): boolean {
  return FIXTURE_DETAIL_FIELDS.some((field) => input[field] !== undefined);
}
