export interface PairFixtureRecord { _id?: unknown; roundNumber: number; homeSeasonTeamRef: unknown; awaySeasonTeamRef: unknown; }
export type PairFixtureError = "DUPLICATE_PAIR_IN_ROUND" | "DUPLICATE_TEAM_PAIR" | "PAIR_FIXTURE_LIMIT" | "DUPLICATE_HOME_AWAY_ORIENTATION";
export function getPairFixtureError(fixtures: PairFixtureRecord[], roundNumber: number, homeId: string, awayId: string, homeAndAway: boolean, excludeId?: string): PairFixtureError | null {
  const existing = fixtures.filter(match => String(match._id ?? "") !== (excludeId ?? ""));
  if (existing.some(match => match.roundNumber === roundNumber)) return "DUPLICATE_PAIR_IN_ROUND";
  if (!homeAndAway && existing.length) return "DUPLICATE_TEAM_PAIR";
  if (homeAndAway) {
    if (existing.length >= 2) return "PAIR_FIXTURE_LIMIT";
    if (existing.some(match => String(match.homeSeasonTeamRef) === homeId && String(match.awaySeasonTeamRef) === awayId)) return "DUPLICATE_HOME_AWAY_ORIENTATION";
  }
  return null;
}
