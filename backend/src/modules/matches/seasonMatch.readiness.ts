export interface FixtureGroupReadiness {
  groupCount: number;
  unassignedTeamCount: number;
  undersizedGroups: string[];
}

export function getFixtureGroupReadinessBlockers(
  groupStageEnabled: boolean,
  readiness: FixtureGroupReadiness,
): string[] {
  if (!groupStageEnabled) return [];
  const blockers: string[] = [];
  if (readiness.groupCount === 0) blockers.push("Create at least one group before creating fixtures");
  if (readiness.unassignedTeamCount > 0) blockers.push(`${readiness.unassignedTeamCount} participating team(s) are not assigned to a valid group`);
  if (readiness.undersizedGroups.length > 0) blockers.push(`Every group must contain at least two participating teams: ${readiness.undersizedGroups.join(", ")}`);
  return blockers;
}
