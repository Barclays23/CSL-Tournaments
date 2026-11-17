export interface SeasonAwardReadinessResolution {
  status: string;
  reason?: string;
  decidedAt?: Date | string;
}
export interface SeasonAwardReadinessMatch {
  matchNumber: number;
  stage: string;
  status: string;
  homeSeasonTeamRef: unknown;
  awaySeasonTeamRef: unknown;
  winnerSeasonTeamRef: unknown;
  resolutionHistory?: SeasonAwardReadinessResolution[];
}
export interface SeasonAwardReadinessSnapshot {
  matches: SeasonAwardReadinessMatch[];
  seasonTeamIds: unknown[];
  pendingAuctionLots: number;
}

const referenceId = (value: unknown): string => {
  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return value == null ? "" : String(value);
};

function hasAuditedCancellation(match: SeasonAwardReadinessMatch): boolean {
  return Boolean(match.resolutionHistory?.some((entry) =>
    entry.status === "cancelled"
    && typeof entry.reason === "string"
    && entry.reason.trim().length >= 3
    && Boolean(entry.decidedAt),
  ));
}

export function getSeasonAwardReadinessBlockers(snapshot: SeasonAwardReadinessSnapshot): string[] {
  const blockers: string[] = [];
  if (snapshot.matches.length === 0) {
    blockers.push("Create the season fixtures before assigning achievements and awards");
  }

  const seasonTeamIds = new Set(snapshot.seasonTeamIds.map(referenceId).filter(Boolean));
  const unfinished = new Map<string, number>();
  let invalidParticipants = 0;
  let invalidKnockoutWinners = 0;
  let unauditedCancellations = 0;

  for (const match of snapshot.matches) {
    const home = referenceId(match.homeSeasonTeamRef);
    const away = referenceId(match.awaySeasonTeamRef);
    if (!home || !away || home === away || !seasonTeamIds.has(home) || !seasonTeamIds.has(away)) {
      invalidParticipants += 1;
    }

    if (match.status === "completed") {
      if (match.stage !== "group") {
        const winner = referenceId(match.winnerSeasonTeamRef);
        if (!winner || (winner !== home && winner !== away) || !seasonTeamIds.has(winner)) {
          invalidKnockoutWinners += 1;
        }
      }
      continue;
    }

    if (match.status === "cancelled") {
      if (!hasAuditedCancellation(match)) unauditedCancellations += 1;
      continue;
    }

    unfinished.set(match.status, (unfinished.get(match.status) ?? 0) + 1);
  }

  if (invalidParticipants) {
    blockers.push(invalidParticipants + " fixture(s) have invalid or cross-season team references");
  }
  for (const status of ["live", "scheduled", "postponed", "abandoned"]) {
    const count = unfinished.get(status) ?? 0;
    if (count) blockers.push(count + " " + status + " fixture(s) must be resolved before assigning honours");
  }
  for (const [status, count] of unfinished) {
    if (!["live", "scheduled", "postponed", "abandoned"].includes(status)) {
      blockers.push(count + " fixture(s) have unsupported status " + status);
    }
  }
  if (unauditedCancellations) {
    blockers.push(unauditedCancellations + " cancelled fixture(s) need an audited cancellation reason");
  }
  if (invalidKnockoutWinners) {
    blockers.push(invalidKnockoutWinners + " completed knockout fixture(s) are missing a valid winner");
  }
  if (snapshot.pendingAuctionLots > 0) {
    blockers.push(snapshot.pendingAuctionLots + " pending auction lot(s) remain");
  }
  return blockers;
}
