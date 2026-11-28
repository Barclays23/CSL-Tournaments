import assert from "node:assert/strict";
import test from "node:test";
import type { MockSeasonMatch } from "./seasonSeed.ts";
import type { MockFail } from "./matchLifecycleRules.ts";
import {
  assertMockPhaseTransitionAllowed,
  getMockExtraTimeOutcome,
  getMockRegularFullTimeOutcome,
  mockPeriodElapsedSeconds,
  resolveMockEventTiming,
  startMockMatchClock,
  stopMockMatchClock,
} from "./matchOperations.ts";

const start = new Date("2026-11-27T12:00:00.000Z");
const fail: MockFail = (status, message, errorCode, details) => {
  throw Object.assign(new Error(message), { status, errorCode, details });
};

function match(overrides: Partial<MockSeasonMatch> = {}): MockSeasonMatch {
  return {
    _id: "match-1",
    seasonRef: "season-1",
    matchNumber: 1,
    roundNumber: 1,
    stage: "final",
    groupRef: null,
    kickoffAt: start.toISOString(),
    venueRef: "venue-1",
    venue: "Main Ground",
    homeSeasonTeamRef: "home",
    awaySeasonTeamRef: "away",
    status: "live",
    matchDurationMinutes: 30,
    decidingRules: {
      extraTime: { isAllowed: false, durationMinutes: 10 },
      penaltyShootout: { isAllowed: false },
    },
    actualStartedAt: start.toISOString(),
    phase: "first_half",
    clock: {
      isRunning: true,
      clockStartedAt: start.toISOString(),
      periodElapsedSecondsByPeriod: {
        firstHalf: 0,
        secondHalf: 0,
        extraTimeFirstHalf: 0,
        extraTimeSecondHalf: 0,
      },
    },
    goals: [],
    cards: [],
    penaltyShootout: null,
    winnerSeasonTeamRef: null,
    notes: null,
    resolutionHistory: [],
    statusHistory: [],
    correctionHistory: [],
    auditHistory: [],
    createdAt: start.toISOString(),
    updatedAt: start.toISOString(),
    ...overrides,
  };
}

function expectCode(run: () => unknown, code: string) {
  assert.throws(run, (error: unknown) =>
    error instanceof Error && "errorCode" in error && error.errorCode === code,
  );
}

test("mock pause and resume preserve elapsed seconds and exclude paused time", () => {
  const original = match();
  const pauseAt = new Date(start.getTime() + 23 * 60_000);
  const elapsedBeforePause = mockPeriodElapsedSeconds(original, "first_half", pauseAt.getTime());
  assert.equal(elapsedBeforePause, 23 * 60);

  const stoppedClock = stopMockMatchClock(original, fail, pauseAt);
  assert.equal(stoppedClock.isRunning, false);
  assert.equal(stoppedClock.clockStartedAt, null);
  assert.equal(stoppedClock.periodElapsedSecondsByPeriod.firstHalf, 23 * 60);

  const pausedMatch = { ...original, clock: stoppedClock };
  const resumeAt = new Date(pauseAt.getTime() + 7 * 60_000);
  const resumedClock = startMockMatchClock(pausedMatch, "first_half", fail, resumeAt);
  const resumedMatch = { ...pausedMatch, clock: resumedClock };
  const sevenMinutesAfterResume = new Date(resumeAt.getTime() + 7 * 60_000);
  assert.equal(
    mockPeriodElapsedSeconds(resumedMatch, "first_half", sevenMinutesAfterResume.getTime()),
    30 * 60,
  );
  assert.equal(resumedClock.periodElapsedSecondsByPeriod.firstHalf, 23 * 60);
});

test("mock event timing rejects future stoppage minutes and accepts elapsed added time", () => {
  const current = match();
  const atFifteenPlusOneTwenty = new Date(start.getTime() + (15 * 60 + 80) * 1000);
  const valid = resolveMockEventTiming(
    current,
    { period: "first_half", minute: 15, addedMinutes: 1 },
    fail,
    atFifteenPlusOneTwenty.getTime(),
  );
  assert.deepEqual(valid, { period: "first_half", minute: 15, addedMinutes: 1 });

  expectCode(() => resolveMockEventTiming(
    current,
    { period: "first_half", minute: 15, addedMinutes: 2 },
    fail,
    atFifteenPlusOneTwenty.getTime(),
  ), "MATCH_EVENT_IN_FUTURE");
});

test("completed-match mock timing correction requires explicit period/minute and preserves added time", () => {
  const completed = match({
    status: "completed",
    phase: "full_time",
    actualStartedAt: start.toISOString(),
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 900, secondHalf: 900, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  });
  const corrected = resolveMockEventTiming(completed, { minute: 28, addedMinutes: 0 }, fail, Date.now(), {
    period: "second_half", minute: 27, addedMinutes: 0,
  }, true);
  assert.deepEqual(corrected, { period: "second_half", minute: 28, addedMinutes: 0 });
  expectCode(() => resolveMockEventTiming(completed, {}, fail, Date.now(), undefined, true), "MATCH_EVENT_PERIOD_REQUIRED");
  expectCode(() => resolveMockEventTiming(completed, { period: "second_half" }, fail, Date.now(), undefined, true), "MATCH_EVENT_MINUTE_REQUIRED");
});

test("mock event timing rejects a future period even if the user supplies a valid minute", () => {
  expectCode(() => resolveMockEventTiming(
    match(),
    { period: "second_half", minute: 16 },
    fail,
  ), "MATCH_EVENT_FUTURE_PERIOD");
});

test("mock Regular Full Time supports all four independent Extra Time and shootout combinations", () => {
  const tiedScore = [0, 0] as const;
  const combinations = [
    { extraTime: true, shootout: true, outcome: "extra_time" },
    { extraTime: true, shootout: false, outcome: "extra_time" },
    { extraTime: false, shootout: true, outcome: "penalty_shootout" },
    { extraTime: false, shootout: false, outcome: "complete" },
  ] as const;
  for (const option of combinations) {
    const current = match({
      decidingRules: {
        extraTime: { isAllowed: option.extraTime, durationMinutes: 10 },
        penaltyShootout: { isAllowed: option.shootout },
      },
    });
    assert.equal(getMockRegularFullTimeOutcome(current, ...tiedScore), option.outcome);
  }
});

test("mock Extra Time decides directly unless the score is tied and shootout is enabled", () => {
  const withShootout = match({ decidingRules: {
    extraTime: { isAllowed: true, durationMinutes: 10 },
    penaltyShootout: { isAllowed: true },
  } });
  const withoutShootout = match({ decidingRules: {
    extraTime: { isAllowed: true, durationMinutes: 10 },
    penaltyShootout: { isAllowed: false },
  } });
  assert.equal(getMockExtraTimeOutcome(withShootout, 1, 0), "complete");
  assert.equal(getMockExtraTimeOutcome(withShootout, 1, 1), "penalty_shootout");
  assert.equal(getMockExtraTimeOutcome(withoutShootout, 1, 1), "complete");
});

test("mock Group Stage cannot enter Extra Time even when the fixture is tied", () => {
  const group = match({
    stage: "group",
    groupRef: "group-1",
    phase: "regular_full_time",
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: {
        firstHalf: 900,
        secondHalf: 900,
        extraTimeFirstHalf: 0,
        extraTimeSecondHalf: 0,
      },
    },
    decidingRules: {
      extraTime: { isAllowed: false, durationMinutes: 10 },
      penaltyShootout: { isAllowed: false },
    },
  });
  expectCode(() => assertMockPhaseTransitionAllowed(group, "start_extra_time", 1, 1, fail), "GROUP_EXTRA_TIME");
});


test("mock clock correction rejects values that place a timed event after the corrected period clock", async () => {
  const { resolveMockClockCorrection } = await import("./matchOperations.ts");
  const paused = match({
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 900, secondHalf: 900, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
    goals: [{
      _id: "goal-1", scoringSeasonTeamRef: "home", scorerPlayerRef: "p1",
      playerSeasonTeamRef: "home", goalType: "normal", period: "second_half", minute: 27, addedMinutes: 0,
      createdAt: start.toISOString(),
    }],
  });
  expectCode(() => resolveMockClockCorrection(paused, { secondHalf: 600 }, fail), "MATCH_CLOCK_BEFORE_EXISTING_EVENT");
  assert.deepEqual(resolveMockClockCorrection(paused, { secondHalf: 800 }, fail), {
    firstHalf: 900, secondHalf: 800, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0,
  });
});

test("mock clock correction rejects elapsed time in a period the Match has not reached", async () => {
  const { resolveMockClockCorrection } = await import("./matchOperations.ts");
  const firstHalf = match({
    phase: "first_half",
    clock: { isRunning: false, clockStartedAt: null, periodElapsedSecondsByPeriod: { firstHalf: 900, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 } },
  });
  expectCode(() => resolveMockClockCorrection(firstHalf, { secondHalf: 1 }, fail), "MATCH_CLOCK_FUTURE_PERIOD");
  expectCode(() => resolveMockClockCorrection(firstHalf, { extraTimeFirstHalf: 1 }, fail), "MATCH_CLOCK_FUTURE_PERIOD");
});

test("mock clock correction rejects Extra Time values when Extra Time is disabled", async () => {
  const { resolveMockClockCorrection } = await import("./matchOperations.ts");
  const afterRegularTime = match({
    phase: "regular_full_time",
    clock: { isRunning: false, clockStartedAt: null, periodElapsedSecondsByPeriod: { firstHalf: 900, secondHalf: 900, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 } },
  });
  expectCode(() => resolveMockClockCorrection(afterRegularTime, { extraTimeFirstHalf: 1 }, fail), "EXTRA_TIME_DISABLED");
});

test("mock phase correction enforces stopped clock, Group Stage and deciding-rule constraints", async () => {
  const { assertMockPhaseCorrectionAllowed } = await import("./matchOperations.ts");
  const stoppedGroup = match({
    stage: "group",
    phase: "regular_full_time",
    clock: {
      isRunning: false, clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 900, secondHalf: 900, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
    decidingRules: { extraTime: { isAllowed: false, durationMinutes: 10 }, penaltyShootout: { isAllowed: false } },
  });
  expectCode(() => assertMockPhaseCorrectionAllowed(stoppedGroup, "extra_time_first_half", 0, 0, fail), "EXTRA_TIME_DISABLED");
  expectCode(() => assertMockPhaseCorrectionAllowed({ ...stoppedGroup, clock: { ...stoppedGroup.clock, isRunning: true } }, "second_half", 0, 0, fail), "MATCH_PHASE_CORRECTION_NOT_ALLOWED");
});
