import { AppError } from "../../shared/errors/appError.js";
import type { MatchPhaseAction } from "./seasonMatch.engine.js";
import type { MatchDecidingRules, MatchPhase, SeasonMatchStage, SeasonMatchStatus, SeasonPenaltyShootout } from "./seasonMatch.types.js";

export type MatchDecidingOutcome = "complete" | "extra_time" | "penalty_shootout";

export interface MatchPhaseState {
  status: SeasonMatchStatus;
  stage: SeasonMatchStage;
  phase: MatchPhase;
  decidingRules: MatchDecidingRules;
  penaltyShootout: SeasonPenaltyShootout | null;
}

export function getRegularFullTimeOutcome(
  stage: SeasonMatchStage,
  rules: MatchDecidingRules,
  homeScore: number,
  awayScore: number,
): MatchDecidingOutcome {
  if (homeScore !== awayScore || stage === "group") return "complete";
  if (rules.extraTime.isAllowed) return "extra_time";
  if (rules.penaltyShootout.isAllowed) return "penalty_shootout";
  return "complete";
}

export function getExtraTimeOutcome(
  rules: MatchDecidingRules,
  homeScore: number,
  awayScore: number,
): MatchDecidingOutcome {
  if (homeScore !== awayScore) return "complete";
  return rules.penaltyShootout.isAllowed ? "penalty_shootout" : "complete";
}

function reject(message: string, code: string): never {
  throw new AppError(message, 409, code);
}

export function assertPhaseTransitionAllowed(
  match: MatchPhaseState,
  action: MatchPhaseAction,
  homeScore: number,
  awayScore: number,
): void {
  if (match.status !== "live") reject("Phase transitions are available only while the match is Live.", "MATCH_NOT_LIVE");
  const tied = homeScore === awayScore;

  switch (action) {
    case "half_time":
      if (match.phase !== "first_half") reject("Half Time can only follow the First Half.", "INVALID_MATCH_PHASE_TRANSITION");
      return;
    case "start_second_half":
      if (match.phase !== "half_time") reject("The Second Half can only start after Half Time.", "INVALID_MATCH_PHASE_TRANSITION");
      return;
    case "regular_full_time":
      if (match.phase !== "second_half") reject("Regular Full Time can only follow the Second Half.", "INVALID_MATCH_PHASE_TRANSITION");
      return;
    case "start_extra_time":
      if (match.phase !== "regular_full_time") reject("Extra Time can only start after Regular Full Time.", "INVALID_MATCH_PHASE_TRANSITION");
      if (match.stage === "group") reject("Group-stage matches cannot use Extra Time.", "GROUP_EXTRA_TIME");
      if (!tied) reject("Extra Time is only available when the regular-time score is tied.", "EXTRA_TIME_NOT_REQUIRED");
      if (!match.decidingRules.extraTime.isAllowed) reject("Extra Time is disabled for this fixture.", "EXTRA_TIME_DISABLED");
      return;
    case "extra_time_half_time":
      if (match.phase !== "extra_time_first_half") reject("Extra Time Half Time can only follow the first Extra Time half.", "INVALID_MATCH_PHASE_TRANSITION");
      return;
    case "start_extra_time_second_half":
      if (match.phase !== "extra_time_half_time") reject("The second Extra Time half can only start after its half-time break.", "INVALID_MATCH_PHASE_TRANSITION");
      return;
    case "end_extra_time":
      if (match.phase !== "extra_time_second_half") reject("Extra Time can only end after its second half.", "INVALID_MATCH_PHASE_TRANSITION");
      return;
    case "start_penalty_shootout":
      if (match.phase !== "regular_full_time" && match.phase !== "extra_time_completed") {
        reject("A Penalty Shootout can only start after Regular Full Time or completed Extra Time.", "INVALID_MATCH_PHASE_TRANSITION");
      }
      if (match.stage === "group") reject("Group-stage matches cannot use a Penalty Shootout.", "GROUP_PENALTY_SHOOTOUT");
      if (!tied) reject("A Penalty Shootout is only available when the normal match score is tied.", "SHOOTOUT_NOT_REQUIRED");
      if (!match.decidingRules.penaltyShootout.isAllowed) reject("Penalty Shootout is disabled for this fixture.", "SHOOTOUT_DISABLED");
      if (match.phase === "regular_full_time" && match.decidingRules.extraTime.isAllowed) {
        reject("Complete the configured Extra Time periods before starting a Penalty Shootout.", "EXTRA_TIME_REQUIRED");
      }
      return;
    case "complete_penalty_shootout":
      if (match.phase !== "penalty_shootout") reject("A Penalty Shootout can only be completed while it is active.", "INVALID_MATCH_PHASE_TRANSITION");
      if (!match.penaltyShootout) reject("Record the penalty kicks before completing the shootout.", "SHOOTOUT_REQUIRED");
      return;
  }
}
