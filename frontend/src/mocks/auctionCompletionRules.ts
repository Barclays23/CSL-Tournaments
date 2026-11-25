export interface MockAuctionSetupTeam {
  _id: string;
  displayName: string;
  groupRef: string | null;
}

/** Validate that every configured team slot is registered and every participating team is grouped. */
export function getMockAuctionSetupBlockers(
  configuredTeamCount: number,
  teams: MockAuctionSetupTeam[],
  groupStageEnabled: boolean,
  validGroupIds: string[],
): string[] {
  const blockers: string[] = [];
  if (teams.length !== configuredTeamCount) {
    blockers.push("Registered eligible teams must exactly match the configured season team count");
  }
  if (groupStageEnabled) {
    const groupIds = new Set(validGroupIds);
    const unassignedTeams = teams.filter((team) => !team.groupRef || !groupIds.has(team.groupRef));
    if (unassignedTeams.length) {
      blockers.push("Assign every participating team to a valid Season Group before completing the auction: " + unassignedTeams.map((team) => team.displayName).join(", "));
    }
  }
  return blockers;
}
