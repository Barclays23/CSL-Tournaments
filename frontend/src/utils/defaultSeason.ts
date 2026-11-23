import type { Season } from "@/types/season.types";

function dateAt(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function startOfSeason(season: Season): Date {
  return dateAt(season.startDate, new Date(season.year, 0, 1));
}

function endOfSeason(season: Season): Date {
  const fallback = new Date(season.year, 11, 31, 23, 59, 59, 999);
  if (!season.endDate) return fallback;
  const parsed = new Date(`${season.endDate.slice(0, 10)}T23:59:59.999`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function distance(left: Date, right: Date): number {
  return Math.abs(left.getTime() - right.getTime());
}

/** Pick active first, otherwise the nearest completed or upcoming competition. */
export function getDefaultSeason(seasons: Season[], now = new Date()): Season | null {
  if (!seasons.length) return null;
  const active = seasons
    .filter((season) => season.status === "active")
    .sort((a, b) => distance(startOfSeason(a), now) - distance(startOfSeason(b), now));
  if (active[0]) return active[0];

  const completed = seasons
    .filter((season) => season.status === "completed" || season.status === "archived")
    .sort((a, b) => endOfSeason(b).getTime() - endOfSeason(a).getTime());
  const upcoming = seasons
    .filter((season) => season.status === "upcoming")
    .sort((a, b) => startOfSeason(a).getTime() - startOfSeason(b).getTime());

  const lastCompleted = completed[0];
  const nextUpcoming = upcoming[0];
  if (lastCompleted && nextUpcoming) {
    return distance(endOfSeason(lastCompleted), now) <= distance(startOfSeason(nextUpcoming), now)
      ? lastCompleted
      : nextUpcoming;
  }
  return lastCompleted ?? nextUpcoming ?? null;
}
