import type { SeasonMatch } from "@/types/seasonMatch.types";

type EditableMatchCandidate = Pick<SeasonMatch, "status" | "goals"> & {
  cards?: unknown[] | null;
};

/**
 * Match details are editable only before any match events have been recorded,
 * and only while the fixture is Scheduled or Live.
 */
export function canEditSeasonMatch(match: EditableMatchCandidate): boolean {
  const hasGoals = match.goals.length > 0;
  const hasCards = Array.isArray(match.cards) && match.cards.length > 0;

  return (match.status === "scheduled" || match.status === "live")
    && !hasGoals
    && !hasCards;
}
