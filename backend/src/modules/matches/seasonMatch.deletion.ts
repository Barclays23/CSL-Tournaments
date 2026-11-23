export interface MatchIncidentSnapshot {
  goals?: unknown[];
  cards?: unknown[];
  penaltyShootout?: { kicks?: unknown[] } | null;
  correctionHistory?: unknown[];
}

export function hasRecordedMatchIncidents(match: MatchIncidentSnapshot): boolean {
  return Boolean(
    (match.goals?.length ?? 0) > 0
    || (match.cards?.length ?? 0) > 0
    || (match.penaltyShootout?.kicks?.length ?? 0) > 0
    || (match.correctionHistory?.length ?? 0) > 0,
  );
}
