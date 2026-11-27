import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../shared/errors/appError.js";
import {
  eventElapsedSeconds,
  getPeriodElapsedSeconds,
  resolveMatchEventTiming,
  startTimedPeriodClock,
  stopTimedPeriodClock,
  type MatchEventTimingInput,
} from "./seasonMatch.engine.js";
import type { SeasonMatchEntity } from "./seasonMatch.types.js";

const zeroElapsed = { firstHalf: 0, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 };

function match(overrides: Partial<SeasonMatchEntity> = {}): SeasonMatchEntity {
  return {
    _id: "507f1f77bcf86cd799439011" as unknown as SeasonMatchEntity["_id"],
    seasonRef: "507f1f77bcf86cd799439012" as unknown as SeasonMatchEntity["seasonRef"],
    matchNumber: 1,
    roundNumber: 1,
    stage: "group",
    groupRef: null,
    kickoffAt: new Date("2026-11-27T10:00:00.000Z"),
    venueRef: "507f1f77bcf86cd799439013" as unknown as SeasonMatchEntity["venueRef"],
    homeSeasonTeamRef: "507f1f77bcf86cd799439014" as unknown as SeasonMatchEntity["homeSeasonTeamRef"],
    awaySeasonTeamRef: "507f1f77bcf86cd799439015" as unknown as SeasonMatchEntity["awaySeasonTeamRef"],
    status: "live",
    matchDurationMinutes: 30,
    decidingRules: { extraTime: { isAllowed: false, durationMinutes: 10 }, penaltyShootout: { isAllowed: false } },
    actualStartedAt: new Date("2026-11-27T10:00:00.000Z"),
    phase: "first_half",
    clock: { isRunning: false, clockStartedAt: null, periodElapsedSecondsByPeriod: { ...zeroElapsed } },
    goals: [],
    cards: [],
    penaltyShootout: null,
    winnerSeasonTeamRef: null,
    notes: null,
    resolutionHistory: [],
    statusHistory: [],
    correctionHistory: [],
    auditHistory: [],
    createdAt: new Date("2026-11-27T09:00:00.000Z"),
    updatedAt: new Date("2026-11-27T10:00:00.000Z"),
    ...overrides,
  } as SeasonMatchEntity;
}

function errorCode(fn: () => unknown, expected: string): void {
  assert.throws(fn, (error: unknown) => error instanceof AppError && error.errorCode === expected);
}

test("pause and resume persist only running seconds and preserve the period", () => {
  const start = new Date("2026-11-27T10:00:00.000Z");
  const clock = startTimedPeriodClock({ isRunning: false, clockStartedAt: null, periodElapsedSecondsByPeriod: { ...zeroElapsed, firstHalf: 90 } }, "first_half", start);
  const running = match({ phase: "first_half", clock });
  const pausedAt = new Date("2026-11-27T10:02:10.000Z");
  const stopped = stopTimedPeriodClock(running, pausedAt);
  assert.equal(stopped.isRunning, false);
  assert.equal(stopped.clockStartedAt, null);
  assert.equal(stopped.periodElapsedSecondsByPeriod.firstHalf, 220);

  const resumedAt = new Date("2026-11-27T10:15:00.000Z");
  const resumed = startTimedPeriodClock(stopped, "first_half", resumedAt);
  const resumedMatch = match({ phase: "first_half", clock: resumed });
  assert.equal(getPeriodElapsedSeconds(resumedMatch, "first_half", new Date("2026-11-27T10:16:00.000Z")), 280);
  assert.equal(resumedMatch.phase, "first_half");
});

test("pause does not include time spent stopped", () => {
  const stored = match({
    phase: "second_half",
    clock: { isRunning: false, clockStartedAt: null, periodElapsedSecondsByPeriod: { ...zeroElapsed, firstHalf: 900, secondHalf: 420 } },
  });
  assert.equal(getPeriodElapsedSeconds(stored, "second_half", new Date("2026-11-27T12:00:00.000Z")), 420);
});

test("stoppage-time events cannot be recorded ahead of the elapsed server clock", () => {
  const start = new Date("2026-11-27T10:00:00.000Z");
  const running = match({
    matchDurationMinutes: 30,
    clock: { isRunning: true, clockStartedAt: start, periodElapsedSecondsByPeriod: { ...zeroElapsed } },
  });

  // 15+01:20: the first added minute has elapsed, but the second has not.
  const atOneMinuteTwenty = new Date("2026-11-27T10:16:20.000Z");
  assert.deepEqual(
    resolveMatchEventTiming(running, {}, atOneMinuteTwenty),
    { period: "first_half", minute: 15, addedMinutes: 1 },
  );
  assert.deepEqual(
    resolveMatchEventTiming(running, { period: "first_half", minute: 15, addedMinutes: 1 }, atOneMinuteTwenty),
    { period: "first_half", minute: 15, addedMinutes: 1 },
  );
  errorCode(
    () => resolveMatchEventTiming(running, { period: "first_half", minute: 15, addedMinutes: 2 }, atOneMinuteTwenty),
    "MATCH_EVENT_IN_FUTURE",
  );

  // At 15+02:00, the second added minute is now a valid event time.
  const atTwoMinutes = new Date("2026-11-27T10:17:00.000Z");
  assert.deepEqual(
    resolveMatchEventTiming(running, { period: "first_half", minute: 15, addedMinutes: 2 }, atTwoMinutes),
    { period: "first_half", minute: 15, addedMinutes: 2 },
  );
  assert.equal(
    eventElapsedSeconds(running, { period: "first_half", minute: 15, addedMinutes: 1 }),
    16 * 60,
  );
  assert.equal(
    eventElapsedSeconds(running, { period: "first_half", minute: 15, addedMinutes: 2 }),
    17 * 60,
  );
});

test("second-half event minutes are cumulative match minutes", () => {
  const start = new Date("2026-11-27T10:00:00.000Z");
  const secondHalf = match({
    phase: "second_half",
    clock: { isRunning: true, clockStartedAt: start, periodElapsedSecondsByPeriod: { ...zeroElapsed, firstHalf: 900 } },
  });
  const timing = resolveMatchEventTiming(secondHalf, {}, new Date("2026-11-27T10:12:00.000Z"));
  assert.deepEqual(timing, { period: "second_half", minute: 27, addedMinutes: 0 });
});

test("a first-minute event defaults to 1' and is not rejected as a future minute", () => {
  const start = new Date("2026-11-27T10:00:00.000Z");
  const running = match({
    clock: { isRunning: true, clockStartedAt: start, periodElapsedSecondsByPeriod: { ...zeroElapsed } },
  });
  assert.deepEqual(
    resolveMatchEventTiming(running, {}, new Date("2026-11-27T10:00:30.000Z")),
    { period: "first_half", minute: 1, addedMinutes: 0 },
  );
});

test("future event times and future periods are rejected", () => {
  const start = new Date("2026-11-27T10:00:00.000Z");
  const running = match({
    clock: { isRunning: true, clockStartedAt: start, periodElapsedSecondsByPeriod: { ...zeroElapsed } },
  });
  const now = new Date("2026-11-27T10:12:00.000Z");
  errorCode(() => resolveMatchEventTiming(running, { minute: 15 }, now), "MATCH_EVENT_IN_FUTURE");
  errorCode(() => resolveMatchEventTiming(running, { period: "second_half", minute: 16 }, now), "MATCH_EVENT_FUTURE_PERIOD");
});

test("events may be assigned to a previously completed period", () => {
  const halfTime = match({
    phase: "half_time",
    clock: { isRunning: false, clockStartedAt: null, periodElapsedSecondsByPeriod: { ...zeroElapsed, firstHalf: 900 } },
  });
  assert.deepEqual(resolveMatchEventTiming(halfTime, { minute: 14 }), {
    period: "first_half", minute: 14, addedMinutes: 0,
  });
  const secondHalf = match({
    phase: "second_half",
    clock: { isRunning: true, clockStartedAt: new Date("2026-11-27T10:00:00.000Z"), periodElapsedSecondsByPeriod: { ...zeroElapsed, firstHalf: 900 } },
  });
  assert.deepEqual(resolveMatchEventTiming(secondHalf, { period: "first_half", minute: 15 }, new Date("2026-11-27T10:12:00.000Z")), {
    period: "first_half", minute: 15, addedMinutes: 0,
  });
});

test("completed-match corrections require explicit event period and minute", () => {
  const completed = match({
    status: "completed",
    phase: "full_time",
    clock: { isRunning: false, clockStartedAt: null, periodElapsedSecondsByPeriod: { ...zeroElapsed, firstHalf: 900, secondHalf: 900 } },
  });
  errorCode(() => resolveMatchEventTiming(completed, {}, new Date(), undefined, true), "MATCH_EVENT_PERIOD_REQUIRED");
  errorCode(() => resolveMatchEventTiming(completed, { period: "first_half" }, new Date(), undefined, true), "MATCH_EVENT_MINUTE_REQUIRED");
  assert.deepEqual(resolveMatchEventTiming(completed, { period: "first_half", minute: 14 }, new Date(), undefined, true), {
    period: "first_half", minute: 14, addedMinutes: 0,
  });
});

test("scheduled matches cannot add timed events", () => {
  const scheduled = match({ status: "scheduled", actualStartedAt: null, phase: null });
  errorCode(() => resolveMatchEventTiming(scheduled, { period: "first_half", minute: 1 }), "MATCH_EVENT_MANAGEMENT_NOT_ALLOWED");
});

test("editing event details preserves existing time unless a new time is supplied", () => {
  const running = match({
    clock: { isRunning: true, clockStartedAt: new Date("2026-11-27T10:00:00.000Z"), periodElapsedSecondsByPeriod: { ...zeroElapsed } },
  });
  const existing: MatchEventTimingInput = { period: "first_half", minute: 8, addedMinutes: 0 };
  assert.deepEqual(resolveMatchEventTiming(running, {}, new Date("2026-11-27T10:12:00.000Z"), existing), existing);
  errorCode(() => resolveMatchEventTiming(running, { minute: 15 }, new Date("2026-11-27T10:12:00.000Z"), existing), "MATCH_EVENT_IN_FUTURE");

  const stoppage = match({
    clock: { isRunning: true, clockStartedAt: new Date("2026-11-27T10:00:00.000Z"), periodElapsedSecondsByPeriod: { ...zeroElapsed } },
  });
  const previousStoppageTime = { period: "first_half" as const, minute: 15, addedMinutes: 1 };
  assert.deepEqual(
    resolveMatchEventTiming(stoppage, { minute: 14 }, new Date("2026-11-27T10:16:20.000Z"), previousStoppageTime),
    { period: "first_half", minute: 14, addedMinutes: 0 },
  );
});
