export interface MockGroupReadinessInput {
  groupStageEnabled?: boolean;
  groups: Array<{ _id: string; groupName: string }>;
  participatingTeams: Array<{ groupRef: string | null }>;
}

export function getMockFixtureGroupReadinessBlockers(input: MockGroupReadinessInput): string[] {
  if (input.groupStageEnabled === false) return [];
  const blockers: string[] = [];
  if (input.groups.length === 0) blockers.push("Create at least one group before creating fixtures");

  const groupIds = new Set(input.groups.map((group) => group._id));
  const counts = new Map(input.groups.map((group) => [group._id, 0]));
  let unassigned = 0;
  for (const team of input.participatingTeams) {
    if (!team.groupRef || !groupIds.has(team.groupRef)) unassigned += 1;
    else counts.set(team.groupRef, (counts.get(team.groupRef) ?? 0) + 1);
  }
  if (unassigned > 0) blockers.push(`${unassigned} participating team(s) are not assigned to a valid group`);

  const emptyGroups = input.groups.filter((group) => (counts.get(group._id) ?? 0) === 0).map((group) => group.groupName);
  if (emptyGroups.length) blockers.push(`Remove empty groups or assign participating teams before creating fixtures: ${emptyGroups.join(", ")}`);

  const undersizedGroups = input.groups.filter((group) => {
    const count = counts.get(group._id) ?? 0;
    return count > 0 && count < 2;
  }).map((group) => group.groupName);
  if (undersizedGroups.length) blockers.push(`Every group must contain at least two participating teams: ${undersizedGroups.join(", ")}`);
  return blockers;
}

export interface MockMatchIncidentSnapshot {
  goals?: unknown[];
  cards?: unknown[];
  penaltyShootout?: { kicks?: unknown[] } | null;
  correctionHistory?: unknown[];
}

export function hasMockMatchIncidents(match: MockMatchIncidentSnapshot): boolean {
  return (match.goals?.length ?? 0) > 0
    || (match.cards?.length ?? 0) > 0
    || (match.penaltyShootout?.kicks?.length ?? 0) > 0
    || (match.correctionHistory?.length ?? 0) > 0;
}
