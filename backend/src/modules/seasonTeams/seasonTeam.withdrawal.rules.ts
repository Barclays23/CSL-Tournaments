export type WithdrawalTeamStatus = "registered" | "active" | "withdrawn" | "eliminated" | "completed";
export type WithdrawalFixtureStatus = "live" | "scheduled" | "postponed" | "completed" | "cancelled" | "abandoned";
export interface WithdrawalResolution { status: string; reason: string; decidedAt: Date | string; }
export interface WithdrawalFixture { matchNumber: number; status: WithdrawalFixtureStatus | string; resolutionHistory?: WithdrawalResolution[]; }

export function getSeasonTeamWithdrawalBlockers(status: WithdrawalTeamStatus, fixtures: WithdrawalFixture[]): string[] {
  const blockers: string[] = [];
  if (status !== "registered" && status !== "active") {
    blockers.push("Only registered or active SeasonTeams can be withdrawn.");
  }
  for (const fixture of fixtures) {
    if (fixture.status === "completed") continue;
    if (fixture.status === "live") {
      blockers.push("Match " + fixture.matchNumber + " is live.");
      continue;
    }
    if (fixture.status === "scheduled" || fixture.status === "postponed") {
      blockers.push("Match " + fixture.matchNumber + " is " + fixture.status + " and must be resolved first.");
      continue;
    }
    if (fixture.status === "cancelled" || fixture.status === "abandoned") {
      const audited = fixture.resolutionHistory?.some((entry) =>
        entry.status === fixture.status && entry.reason.trim().length >= 3 && Boolean(entry.decidedAt),
      );
      if (!audited) blockers.push("Match " + fixture.matchNumber + " is " + fixture.status + " without an audited resolution reason.");
      continue;
    }
    blockers.push("Match " + fixture.matchNumber + " has an unsupported status: " + fixture.status + ".");
  }
  return blockers;
}