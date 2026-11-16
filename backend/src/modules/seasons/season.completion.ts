import type { SeasonMatchStage, SeasonMatchStatus } from "../matches/seasonMatch.types.js";
import type { SeasonTeamStatus } from "../seasonTeams/seasonTeam.types.js";

export interface CompletionMatch {
  matchNumber: number;
  stage: SeasonMatchStage | string;
  status: SeasonMatchStatus | string;
  homeSeasonTeamRef: unknown;
  awaySeasonTeamRef: unknown;
  winnerSeasonTeamRef: unknown;
}

export interface CompletionSeasonTeam {
  _id: unknown;
  status: SeasonTeamStatus;
}

export interface CompletionAwardRecipient {
  recipientType: "season_team" | "player";
  seasonTeamRef: unknown;
  playerRef: unknown;
}

export interface CompletionAward {
  awardType: string;
  recipients: CompletionAwardRecipient[];
}

export interface SeasonCompletionSnapshot {
  matches: CompletionMatch[];
  seasonTeams: CompletionSeasonTeam[];
  awards: CompletionAward[];
  pendingAuctionLots: number;
}

const id = (value: unknown): string => {
  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return value == null ? "" : String(value);
};

const ELIGIBLE_TEAM_STATUSES = new Set(["registered", "active"]);
const TERMINAL_MATCH_STATUSES = new Set(["completed", "cancelled"]);

export function getSeasonCompletionBlockers(snapshot: SeasonCompletionSnapshot): string[] {
  const blockers: string[] = [];
  const statusCounts = new Map<string, number>();
  for (const match of snapshot.matches) {
    if (!TERMINAL_MATCH_STATUSES.has(match.status)) {
      statusCounts.set(match.status, (statusCounts.get(match.status) ?? 0) + 1);
    }
  }
  for (const status of ["scheduled", "postponed", "live", "abandoned"]) {
    const count = statusCounts.get(status) ?? 0;
    if (count) blockers.push(`${count} ${status} match(es) remaining`);
  }
  for (const [status, count] of statusCounts) {
    if (!["scheduled", "postponed", "live", "abandoned"].includes(status)) {
      blockers.push(`${count} match(es) have unsupported unfinished status "${status}"`);
    }
  }

  const teamIds = new Set(snapshot.seasonTeams.map((team) => id(team._id)));
  const eligibleTeamIds = new Set(snapshot.seasonTeams
    .filter((team) => ELIGIBLE_TEAM_STATUSES.has(team.status))
    .map((team) => id(team._id)));

  const invalidParticipants = snapshot.matches.filter((match) => {
    const home = id(match.homeSeasonTeamRef);
    const away = id(match.awaySeasonTeamRef);
    return !home || !away || home === away || !teamIds.has(home) || !teamIds.has(away);
  });
  if (invalidParticipants.length) {
    blockers.push(`${invalidParticipants.length} match(es) reference invalid or cross-season participants`);
  }

  const invalidKnockout = snapshot.matches.filter((match) => {
    if (match.stage === "group" || match.status !== "completed") return false;
    const home = id(match.homeSeasonTeamRef);
    const away = id(match.awaySeasonTeamRef);
    const winner = id(match.winnerSeasonTeamRef);
    return !winner || (winner !== home && winner !== away) || !teamIds.has(winner);
  });
  if (invalidKnockout.length) {
    blockers.push(`${invalidKnockout.length} completed knockout match(es) are missing a valid participant winner`);
  }

  const mandatoryAward = (type: "champions" | "runner_up"): string | null => {
    const records = snapshot.awards.filter((award) => award.awardType === type);
    if (records.length !== 1 || records[0]?.recipients.length !== 1) return null;
    const recipient = records[0].recipients[0];
    if (!recipient || recipient.recipientType !== "season_team" || id(recipient.playerRef)) return null;
    const teamId = id(recipient.seasonTeamRef);
    return teamId && eligibleTeamIds.has(teamId) ? teamId : null;
  };

  const champion = mandatoryAward("champions");
  const runnerUp = mandatoryAward("runner_up");
  if (!champion) blockers.push("Champion not assigned to one eligible participating SeasonTeam");
  if (!runnerUp) blockers.push("Runner-up not assigned to one eligible participating SeasonTeam");
  if (champion && runnerUp && champion === runnerUp) {
    blockers.push("Champion and Runner-up must be different participating teams");
  }

  if (snapshot.pendingAuctionLots > 0) {
    blockers.push(`${snapshot.pendingAuctionLots} pending auction lot(s) remain`);
  }
  return blockers;
}
