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

export interface LiveFixtureRecord {
  _id?: unknown;
  homeSeasonTeamRef: unknown;
  awaySeasonTeamRef: unknown;
}

export function getLiveMatchConflictingTeamIds(
  fixtures: LiveFixtureRecord[],
  homeId: string,
  awayId: string,
  excludeId?: string,
): string[] {
  const requestedTeamIds = new Set([homeId, awayId]);
  const conflicts = new Set<string>();

  for (const fixture of fixtures) {
    if (String(fixture._id ?? "") === (excludeId ?? "")) continue;

    for (const teamRef of [fixture.homeSeasonTeamRef, fixture.awaySeasonTeamRef]) {
      const teamId = String(teamRef);
      if (requestedTeamIds.has(teamId)) conflicts.add(teamId);
    }
  }

  return [...conflicts];
}


export interface FixtureStageDecidingDefaults {
  extraTime: { isAllowedByDefault: boolean; defaultDurationMinutes: number };
  penaltyShootout: { isAllowedByDefault: boolean };
}

export function resolveFixtureDecidingRulesForStage(
  previousStage: import("./seasonMatch.types.js").SeasonMatchStage,
  nextStage: import("./seasonMatch.types.js").SeasonMatchStage,
  current: import("./seasonMatch.types.js").MatchDecidingRules,
  defaults: FixtureStageDecidingDefaults,
): import("./seasonMatch.types.js").MatchDecidingRules {
  if (nextStage === "group") {
    return {
      extraTime: { isAllowed: false, durationMinutes: current.extraTime.durationMinutes },
      penaltyShootout: { isAllowed: false },
    };
  }
  if (previousStage === "group") {
    return {
      extraTime: {
        isAllowed: defaults.extraTime.isAllowedByDefault,
        durationMinutes: defaults.extraTime.defaultDurationMinutes,
      },
      penaltyShootout: { isAllowed: defaults.penaltyShootout.isAllowedByDefault },
    };
  }
  return {
    extraTime: { ...current.extraTime },
    penaltyShootout: { ...current.penaltyShootout },
  };
}
