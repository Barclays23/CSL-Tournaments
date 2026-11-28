export type MatchLifecycleStatus = "scheduled" | "live" | "completed" | "postponed" | "cancelled" | "abandoned";

export const MATCH_STATUS_TRANSITIONS: Readonly<Record<MatchLifecycleStatus, readonly MatchLifecycleStatus[]>> = {
  scheduled: ["live", "postponed", "cancelled"],
  live: ["completed", "scheduled", "postponed", "abandoned"],
  postponed: ["scheduled", "cancelled"],
  completed: [],
  cancelled: [],
  abandoned: [],
};

const STATUS_LABELS: Record<MatchLifecycleStatus, string> = {
  scheduled: "Scheduled",
  live: "Live",
  completed: "Completed",
  postponed: "Postponed",
  cancelled: "Cancelled",
  abandoned: "Abandoned",
};

export type MockFail = (status: number, message: string, errorCode?: string, details?: Record<string, string>) => never;

export function assertMockStatusTransition(current: MatchLifecycleStatus, next: MatchLifecycleStatus, fail: MockFail): void {
  if (current === next || MATCH_STATUS_TRANSITIONS[current].includes(next)) return;
  let message: string;
  if (current === "completed") message = "Completed matches cannot have their status changed through the normal match update API.";
  else if (current === "cancelled") message = "Cancelled matches are final and cannot be reopened or changed to another status.";
  else if (current === "abandoned") message = "Abandoned matches are final and cannot be reopened or changed to another status.";
  else {
    const allowed = MATCH_STATUS_TRANSITIONS[current].map((status) => STATUS_LABELS[status]).join(", ");
    message = `Cannot change match status from ${STATUS_LABELS[current]} to ${STATUS_LABELS[next]}. Allowed next statuses: ${allowed}.`;
  }
  fail(409, message, "INVALID_MATCH_STATUS_TRANSITION", { status: message });
}

export function assertMockGoalManagementAllowed(status: MatchLifecycleStatus, fail: MockFail): void {
  if (status !== "live") {
    fail(409, "Goals can only be added, edited or removed while the match is Live. Existing goal records are preserved when a match changes status.", "MATCH_GOAL_MANAGEMENT_NOT_ALLOWED");
  }
}

type Goal = {
  scoringSeasonTeamRef: string;
  scorerPlayerRef: string | null;
  playerSeasonTeamRef: string | null;
  goalType: "normal" | "own_goal";
};
type Shootout = {
  status: "pending" | "completed";
  homeTeamScore: number;
  awayTeamScore: number;
  kicks: Array<{ seasonTeamRef: string; playerRef: string | null; result: "scored" | "missed" | "saved" }>;
};
type CompletionMatch = {
  decidingRules?:{extraTime:{isAllowed:boolean;durationMinutes:number};penaltyShootout:{isAllowed:boolean}};
  status:MatchLifecycleStatus;phase?:string|null;
  stage:string;
  homeSeasonTeamRef: string;
  awaySeasonTeamRef: string;
  goals: Goal[];
  penaltyShootout: Shootout | null;
};
type CompletionSeason = {
  matchRules?: {defaultMatchDurationMinutes:number;extraTime:{isAllowedByDefault:boolean;defaultDurationMinutes:number};penaltyShootout:{isAllowedByDefault:boolean}} | null;
  pointsRules?: { win: number; draw: number; loss: number } | null;
};

export function deriveMockMatchScore(match: CompletionMatch, fail: MockFail): { homeScore: number; awayScore: number } {
  const homeId = match.homeSeasonTeamRef, awayId = match.awaySeasonTeamRef;
  if (!homeId || !awayId || homeId === awayId) {
    fail(422, "A completed match must have two different participating teams recorded.", "MATCH_RESULT_INCOMPLETE", { teams: "Both match participants must be recorded." });
  }
  if (!Array.isArray(match.goals)) {
    fail(422, "The match score cannot be calculated because its goal records are missing or invalid.", "MATCH_RESULT_INCOMPLETE", { goals: "Record the match goal events before completing the fixture." });
  }
  let homeScore = 0, awayScore = 0;
  for (const [index, goal] of match.goals.entries()) {
    const invalid = (message: string) => fail(422, message, "MATCH_SCORE_INVALID", { goals: message });
    if (!goal || typeof goal !== "object") invalid(`Goal record ${index + 1} is incomplete.`);
    const scoring = goal.scoringSeasonTeamRef;
    if (scoring !== homeId && scoring !== awayId) invalid(`Goal record ${index + 1} must credit either team participating in this match.`);
    const scorer = goal.scorerPlayerRef, playerTeam = goal.playerSeasonTeamRef;
    if (goal.goalType === "normal") {
      if (!scorer || playerTeam !== scoring) invalid(`Normal goal record ${index + 1} must identify a scorer belonging to the team credited with the goal.`);
    } else if (goal.goalType === "own_goal") {
      if (Boolean(scorer) !== Boolean(playerTeam)) invalid(`Own-goal record ${index + 1} must either identify both the responsible player and their team, or leave both unknown.`);
      if (playerTeam && playerTeam === scoring) invalid(`Own-goal record ${index + 1} must identify a player from the opposing team.`);
    } else invalid(`Goal record ${index + 1} has an unsupported goal type.`);
    if (scoring === homeId) homeScore += 1;
    else awayScore += 1;
  }
  return { homeScore, awayScore };
}

export function assertMockShootoutScore(match: Pick<CompletionMatch, "homeSeasonTeamRef" | "awaySeasonTeamRef">, shootout: Shootout, fail: MockFail): void {
  const homeId = match.homeSeasonTeamRef, awayId = match.awaySeasonTeamRef;
  if (!homeId || !awayId || homeId === awayId) fail(422, "The shootout cannot be validated because the match participants are invalid.", "INVALID_SHOOTOUT_TEAMS");
  const validScore = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (!validScore(shootout.homeTeamScore) || !validScore(shootout.awayTeamScore)) {
    fail(422, "Penalty shootout scores must be whole numbers greater than or equal to zero.", "SHOOTOUT_SCORE_INVALID", { penaltyShootout: "Enter valid non-negative whole-number shootout scores." });
  }
  if (!Array.isArray(shootout.kicks)) fail(422, "Penalty shootout kick details must be a valid list.", "SHOOTOUT_KICKS_INVALID");
  let homeSuccessful = 0, awaySuccessful = 0;
  for (const [index, kick] of shootout.kicks.entries()) {
    const team = kick?.seasonTeamRef;
    if (team !== homeId && team !== awayId) fail(422, `Penalty kick ${index + 1} must belong to one of the teams participating in this match.`, "INVALID_SHOOTOUT_TEAM");
    if (!["scored", "missed", "saved"].includes(kick.result)) fail(422, `Penalty kick ${index + 1} has an invalid result.`, "INVALID_SHOOTOUT_KICK");
    if (kick.result === "scored") {
      if (team === homeId) homeSuccessful += 1;
      else awaySuccessful += 1;
    }
  }
  if (shootout.kicks.length > 0 && (homeSuccessful !== shootout.homeTeamScore || awaySuccessful !== shootout.awayTeamScore)) {
    fail(422, "Penalty shootout scores must match the number of recorded successful kicks for each team.", "SHOOTOUT_SCORE_MISMATCH", { penaltyShootout: "Recheck the shootout scores against the successful kicks." });
  }
  if (shootout.status === "completed" && shootout.homeTeamScore === shootout.awayTeamScore) {
    fail(422, "A completed penalty shootout must produce a winner; the shootout scores cannot be tied.", "SHOOTOUT_TIED", { penaltyShootout: "Record a shootout score with one team ahead." });
  }
}

export function calculateMockCompletedWinner(match: CompletionMatch, season: CompletionSeason, fail: MockFail): string | null {
  if (match.status !== "completed") return null;
  const score = deriveMockMatchScore(match, fail);
  const homeId = match.homeSeasonTeamRef, awayId = match.awaySeasonTeamRef;
  const rules = season.matchRules;
  if (!rules) fail(409, "Match rules are unavailable for this historical season", "SEASON_RULES_UNAVAILABLE");
  if (match.stage === "group") {
    const points = season.pointsRules;
    if (!points || ![points.win, points.draw, points.loss].every((value) => Number.isFinite(value) && value >= 0)) {
      fail(409, "Group-stage matches cannot be completed until valid win, draw and loss points are configured for the season.", "SEASON_POINTS_RULES_UNAVAILABLE");
    }
    if (match.penaltyShootout || match.decidingRules?.extraTime.isAllowed || match.decidingRules?.penaltyShootout.isAllowed) fail(422,"Group-stage matches cannot use Extra Time or Penalty Shootout.","GROUP_DECIDING_RULES");
    // Section 17 requires Group Stage fixtures to complete as a draw when tied.
    // Legacy season points toggles cannot introduce deciding stages or force a winner.
    if (score.homeScore === score.awayScore) return null;
    return score.homeScore > score.awayScore ? homeId : awayId;
  }
  if (score.homeScore === score.awayScore) {
    if(match.decidingRules?.extraTime.isAllowed&&!["extra_time_completed","penalty_shootout_completed","full_time"].includes(match.phase??""))fail(422,"This tied knockout match requires Extra Time before completion","EXTRA_TIME_REQUIRED");
    if(match.decidingRules?.penaltyShootout.isAllowed===false)return null;
    if (!(match.decidingRules?.penaltyShootout.isAllowed ?? rules.penaltyShootout.isAllowedByDefault)) return null;
    const shootout = match.penaltyShootout;
    if (!shootout || shootout.status !== "completed") {
      fail(422, "This knockout match is tied. Record and complete a penalty shootout before completing the match.", "SHOOTOUT_REQUIRED", { penaltyShootout: "A completed penalty shootout is required to determine the winner." });
    }
    assertMockShootoutScore(match, shootout, fail);
    return shootout.homeTeamScore > shootout.awayTeamScore ? homeId : awayId;
  }
  if (match.penaltyShootout) {
    fail(422, "A penalty shootout is only valid when the normal-time match score is tied.", "UNNECESSARY_SHOOTOUT", { penaltyShootout: "Remove the shootout or correct the normal-time score." });
  }
  return score.homeScore > score.awayScore ? homeId : awayId;
}
