import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../shared/errors/appError.js";
import {
  assertPhaseTransitionAllowed,
  getExtraTimeOutcome,
  getRegularFullTimeOutcome,
  type MatchPhaseState,
} from "./seasonMatch.phaseRules.js";
import type { MatchDecidingRules } from "./seasonMatch.types.js";

function rules(extraTime: boolean, shootout: boolean, durationMinutes = 10): MatchDecidingRules {
  return {
    extraTime: { isAllowed: extraTime, durationMinutes },
    penaltyShootout: { isAllowed: shootout },
  };
}
function state(
  phase: MatchPhaseState["phase"],
  decidingRules = rules(false, false),
  stage: MatchPhaseState["stage"] = "final",
  penaltyShootout: MatchPhaseState["penaltyShootout"] = null,
): MatchPhaseState {
  return { status: "live", phase, stage, decidingRules, penaltyShootout };
}
function errorCode(fn: () => void, expected: string): void {
  assert.throws(fn, (error: unknown) => error instanceof AppError && error.errorCode === expected);
}

test("Regular Full Time supports all four independent Extra Time and shootout combinations", () => {
  assert.equal(getRegularFullTimeOutcome("final", rules(true, true), 1, 1), "extra_time");
  assert.equal(getRegularFullTimeOutcome("final", rules(true, false), 1, 1), "extra_time");
  assert.equal(getRegularFullTimeOutcome("final", rules(false, true), 1, 1), "penalty_shootout");
  assert.equal(getRegularFullTimeOutcome("final", rules(false, false), 1, 1), "complete");
  for (const deciding of [rules(true, true), rules(true, false), rules(false, true), rules(false, false)]) {
    assert.equal(getRegularFullTimeOutcome("final", deciding, 2, 1), "complete");
  }
});

test("Group Stage always completes at regular time without extra deciding stages", () => {
  assert.equal(getRegularFullTimeOutcome("group", rules(false, false), 1, 1), "complete");
  errorCode(() => assertPhaseTransitionAllowed(state("regular_full_time", rules(true, false), "group"), "start_extra_time", 1, 1), "GROUP_EXTRA_TIME");
  errorCode(() => assertPhaseTransitionAllowed(state("regular_full_time", rules(false, true), "group"), "start_penalty_shootout", 1, 1), "GROUP_PENALTY_SHOOTOUT");
});

test("after Extra Time, an unequal score completes and a tied score uses the independent shootout option", () => {
  assert.equal(getExtraTimeOutcome(rules(true, true), 2, 1), "complete");
  assert.equal(getExtraTimeOutcome(rules(true, false), 2, 2), "complete");
  assert.equal(getExtraTimeOutcome(rules(true, true), 2, 2), "penalty_shootout");
});

test("each timed period and break transition accepts only the next referee-controlled phase", () => {
  const permitted: Array<[MatchPhaseState["phase"], Parameters<typeof assertPhaseTransitionAllowed>[1], MatchDecidingRules]> = [
    ["first_half", "half_time", rules(false, false)],
    ["half_time", "start_second_half", rules(false, false)],
    ["second_half", "regular_full_time", rules(false, false)],
    ["regular_full_time", "start_extra_time", rules(true, false)],
    ["extra_time_first_half", "extra_time_half_time", rules(true, false)],
    ["extra_time_half_time", "start_extra_time_second_half", rules(true, false)],
    ["extra_time_second_half", "end_extra_time", rules(true, false)],
    ["regular_full_time", "start_penalty_shootout", rules(false, true)],
    ["extra_time_completed", "start_penalty_shootout", rules(true, true)],
    ["penalty_shootout", "complete_penalty_shootout", rules(false, true)],
  ];
  for (const [phase, action, deciding] of permitted) {
    assert.doesNotThrow(() => assertPhaseTransitionAllowed(
      state(phase, deciding, "final", phase === "penalty_shootout" ? { status: "pending", homeTeamScore: 0, awayTeamScore: 0, kicks: [] } : null),
      action,
      1,
      1,
    ), `${phase} -> ${action}`);
  }
});

test("out-of-order transitions, untied deciding stages and disabled rules are rejected", () => {
  errorCode(() => assertPhaseTransitionAllowed(state("first_half"), "regular_full_time", 0, 0), "INVALID_MATCH_PHASE_TRANSITION");
  errorCode(() => assertPhaseTransitionAllowed(state("regular_full_time", rules(true, false)), "start_extra_time", 2, 1), "EXTRA_TIME_NOT_REQUIRED");
  errorCode(() => assertPhaseTransitionAllowed(state("regular_full_time", rules(false, true)), "start_penalty_shootout", 2, 1), "SHOOTOUT_NOT_REQUIRED");
  errorCode(() => assertPhaseTransitionAllowed(state("regular_full_time", rules(false, false)), "start_penalty_shootout", 1, 1), "SHOOTOUT_DISABLED");
  errorCode(() => assertPhaseTransitionAllowed(state("regular_full_time", rules(true, true)), "start_penalty_shootout", 1, 1), "EXTRA_TIME_REQUIRED");
});

test("shootout completion is only allowed from an active shootout with a shootout record", () => {
  errorCode(() => assertPhaseTransitionAllowed(state("extra_time_completed", rules(true, true)), "complete_penalty_shootout", 1, 1), "INVALID_MATCH_PHASE_TRANSITION");
  errorCode(() => assertPhaseTransitionAllowed(state("penalty_shootout", rules(false, true)), "complete_penalty_shootout", 1, 1), "SHOOTOUT_REQUIRED");
});
