import type { SeasonMatch } from "@/types/seasonMatch.types";

/** Fixture identity, schedule and participants can only be edited before actual kickoff. */
export function canEditSeasonMatch(match: Pick<SeasonMatch, "status" | "goals" | "actualStartedAt"> & { cards?: unknown[] | null }): boolean {
  const hasGoals = match.goals.length > 0;
  const hasCards = Array.isArray(match.cards) && match.cards.length > 0;
  return match.status === "scheduled" && !match.actualStartedAt && !hasGoals && !hasCards;
}
