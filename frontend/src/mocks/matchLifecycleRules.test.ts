import assert from "node:assert/strict";
import test from "node:test";
import {
  MATCH_STATUS_TRANSITIONS,
  assertMockGoalManagementAllowed,
  assertMockStatusTransition,
  calculateMockCompletedWinner,
} from "./matchLifecycleRules.ts";

const failure = (status: number, message: string, errorCode?: string, details?: Record<string, string>): never => {
  throw Object.assign(new Error(message), { status, errorCode, details });
};
const isMockError = (error: unknown, status: number, errorCode: string): boolean =>
  error instanceof Error && "status" in error && error.status === status
  && "errorCode" in error && error.errorCode === errorCode;
const home = "home-team";
const away = "away-team";
const normalGoal = (scoringSeasonTeamRef: string, scorer = "player", playerSeasonTeamRef = scoringSeasonTeamRef) => ({
  scoringSeasonTeamRef, scorerPlayerRef: scorer, playerSeasonTeamRef, goalType: "normal" as const,
});
const season = (overrides = {}) => ({
  matchRules:{groupStageDrawAllowed:true,defaultMatchDurationMinutes:30,extraTime:{isAllowedByDefault:false,defaultDurationMinutes:10},penaltyShootout:{isAllowedByDefault:true}},
  pointsRules: { win: 3, draw: 1, loss: 0 },
  ...overrides,
});

test("mock lifecycle transition matrix matches production transitions", () => {
  assert.deepEqual(MATCH_STATUS_TRANSITIONS, {
    scheduled: ["live", "postponed", "cancelled"],
    live: ["completed", "scheduled", "postponed", "abandoned"],
    postponed: ["scheduled", "cancelled"],
    completed: [],
    cancelled: [],
    abandoned: [],
  });
  for (const [current, allowed] of Object.entries(MATCH_STATUS_TRANSITIONS)) {
    assertMockStatusTransition(current as keyof typeof MATCH_STATUS_TRANSITIONS, current as keyof typeof MATCH_STATUS_TRANSITIONS, failure);
    for (const next of Object.keys(MATCH_STATUS_TRANSITIONS) as Array<keyof typeof MATCH_STATUS_TRANSITIONS>) {
      if (next === current || allowed.includes(next)) {
        assert.doesNotThrow(() => assertMockStatusTransition(current as keyof typeof MATCH_STATUS_TRANSITIONS, next, failure));
      } else {
        assert.throws(() => assertMockStatusTransition(current as keyof typeof MATCH_STATUS_TRANSITIONS, next, failure), (error: unknown) => isMockError(error, 409, "INVALID_MATCH_STATUS_TRANSITION"));
      }
    }
  }
});

test("goal management is permitted only while Live for all six statuses", () => {
  for (const status of Object.keys(MATCH_STATUS_TRANSITIONS) as Array<keyof typeof MATCH_STATUS_TRANSITIONS>) {
    if (status === "live") assert.doesNotThrow(() => assertMockGoalManagementAllowed(status, failure));
    else assert.throws(() => assertMockGoalManagementAllowed(status, failure), (error: unknown) => isMockError(error, 409, "MATCH_GOAL_MANAGEMENT_NOT_ALLOWED"));
  }
});

test("group completion validates points, disallowed draws and shootout prohibition", () => {
  const base={status:"completed" as const,stage:"group",homeSeasonTeamRef:home,awaySeasonTeamRef:away,goals:[],penaltyShootout:null,decidingRules:{extraTime:{isAllowed:false,durationMinutes:10},penaltyShootout:{isAllowed:false}}};
  assert.equal(calculateMockCompletedWinner(base, season(), failure), null);
  assert.throws(() => calculateMockCompletedWinner(base, season({matchRules:{...season().matchRules,groupStageDrawAllowed:false}}), failure),
    (error: unknown) => isMockError(error, 422, "GROUP_DRAW_NOT_ALLOWED"));
  assert.throws(() => calculateMockCompletedWinner(base, season({ pointsRules: null }), failure),
    (error: unknown) => isMockError(error, 409, "SEASON_POINTS_RULES_UNAVAILABLE"));
  assert.throws(() => calculateMockCompletedWinner({ ...base, penaltyShootout: { status: "completed", homeTeamScore: 2, awayTeamScore: 1, kicks: [] } }, season(), failure),
    (error: unknown) => isMockError(error, 422, "GROUP_DECIDING_RULES"));
});

test("completed group result calculates winner from goal events only", () => {
  const match = { status: "completed" as const, stage: "group", homeSeasonTeamRef: home, awaySeasonTeamRef: away, goals: [normalGoal(home)], penaltyShootout: null };
  assert.equal(calculateMockCompletedWinner(match, season(), failure), home);
});

test("knockout tied result requires a valid completed shootout and derives its winner", () => {
  const match={status:"completed" as const,stage:"final",homeSeasonTeamRef:home,awaySeasonTeamRef:away,goals:[],decidingRules:{extraTime:{isAllowed:false,durationMinutes:10},penaltyShootout:{isAllowed:true}},penaltyShootout:{status:"completed" as const,homeTeamScore:4,awayTeamScore:3,kicks:[]}};
  assert.equal(calculateMockCompletedWinner(match, season(), failure), home);
  assert.throws(() => calculateMockCompletedWinner({ ...match, penaltyShootout: null }, season(), failure),
    (error: unknown) => isMockError(error, 422, "SHOOTOUT_REQUIRED"));
  assert.throws(() => calculateMockCompletedWinner({ ...match, penaltyShootout: { ...match.penaltyShootout, homeTeamScore: 3, awayTeamScore: 3 } }, season(), failure),
    (error: unknown) => isMockError(error, 422, "SHOOTOUT_TIED"));
});

test("knockout result rejects an unnecessary shootout when normal-time score has a winner", () => {
  const match = { status: "completed" as const, stage: "final", homeSeasonTeamRef: home, awaySeasonTeamRef: away, goals: [normalGoal(home)], penaltyShootout: { status: "completed" as const, homeTeamScore: 4, awayTeamScore: 3, kicks: [] } };
  assert.throws(() => calculateMockCompletedWinner(match, season(), failure),
    (error: unknown) => isMockError(error, 422, "UNNECESSARY_SHOOTOUT"));
});

test("invalid normal and own goal event records fail with backend-compatible errors", () => {
  const base = { status: "completed" as const, stage: "group", homeSeasonTeamRef: home, awaySeasonTeamRef: away, penaltyShootout: null };
  assert.throws(() => calculateMockCompletedWinner({ ...base, goals: [normalGoal(home, null as unknown as string)] }, season(), failure),
    (error: unknown) => isMockError(error, 422, "MATCH_SCORE_INVALID"));
  assert.throws(() => calculateMockCompletedWinner({ ...base, goals: [{ scoringSeasonTeamRef: home, scorerPlayerRef: "player", playerSeasonTeamRef: home, goalType: "own_goal" as const }] }, season(), failure),
    (error: unknown) => isMockError(error, 422, "MATCH_SCORE_INVALID"));
});
