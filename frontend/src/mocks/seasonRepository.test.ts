import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { ApiError } from "../utils/errorHandler.js";
import { seasonPreviewRepository } from "./seasonRepository.js";
import { readSeasonDb, commitSeasonDb } from "./seasonStore.js";
import type { MockSeasonMatch } from "./seasonSeed.js";
import { readDb, writeSession } from "./store.js";
import { resetMockSeasonRepositoryState, seedMockSeasonMatch } from "./matchEngineTestUtils.js";

const correctedKickoff = "2026-11-19T12:15:00.000Z";

function expectCode(action: () => unknown, code: string): Promise<void> {
  return assert.rejects(
    async () => { await action(); },
    (error: unknown) => error instanceof ApiError && error.errorCode === code,
  );
}

function goal(
  overrides: Partial<MockSeasonMatch["goals"][number]> = {},
): MockSeasonMatch["goals"][number] {
  return {
    _id: "e00000000000000000000001",
    scoringSeasonTeamRef: match.homeSeasonTeamRef,
    scorerPlayerRef: null,
    playerSeasonTeamRef: null,
    goalType: "own_goal",
    period: "first_half",
    minute: 8,
    addedMinutes: 0,
    createdAt: "2026-11-20T12:08:00.000Z",
    ...overrides,
  };
}

function card(
  overrides: Partial<NonNullable<MockSeasonMatch["cards"]>[number]> = {},
): NonNullable<MockSeasonMatch["cards"]>[number] {
  return {
    _id: "c00000000000000000000001",
    seasonTeamRef: match.homeSeasonTeamRef,
    playerRef: "0000000000000000000000c1",
    cardType: "yellow_card",
    period: "first_half",
    minute: 9,
    addedMinutes: 0,
    createdAt: "2026-11-20T12:09:00.000Z",
    ...overrides,
  };
}

function completedMatch(
  overrides: Partial<MockSeasonMatch> = {},
): { seasonId: string; match: MockSeasonMatch } {
  return seedMockSeasonMatch({
    status: "completed",
    phase: "full_time",
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: {
        firstHalf: 900,
        secondHalf: 1200,
        extraTimeFirstHalf: 0,
        extraTimeSecondHalf: 0,
      },
    },
    ...overrides,
  });
}

function correctionGoal(
  match: MockSeasonMatch,
  overrides: Partial<{
    scoringSeasonTeamRef: string;
    scorerPlayerRef: string | null;
    goalType: "normal" | "own_goal";
    period: "first_half" | "second_half" | "extra_time_first_half" | "extra_time_second_half" | null;
    minute: number | null;
    addedMinutes: number | null;
  }> = {},
) {
  return {
    scoringSeasonTeamRef: match.homeSeasonTeamRef,
    scorerPlayerRef: null,
    goalType: "own_goal" as const,
    ...overrides,
  };
}

beforeEach(() => {
  resetMockSeasonRepositoryState();
});

test("mock repository corrects an existing actual kickoff without changing scheduled kickoff or clock", async () => {
  const { seasonId, match } = seedMockSeasonMatch();
  const scheduledKickoff = match.kickoffAt;
  const clockBefore = structuredClone(match.clock);
  const previousActualKickoff = match.actualStartedAt;

  const response = await seasonPreviewRepository.correctSeasonMatchActualKickoff(
    seasonId,
    match._id,
    { actualStartedAt: correctedKickoff, reason: "Corrected from referee record" },
  );
  const corrected = response.data;
  assert.equal(corrected.actualStartedAt, correctedKickoff);
  assert.equal(corrected.kickoffAt, scheduledKickoff);
  assert.deepEqual(corrected.clock, clockBefore);
  assert.equal(corrected.auditHistory?.at(-1)?.action, "actual_kickoff_correction");
  assert.equal(corrected.auditHistory?.at(-1)?.previousValue.actualStartedAt, previousActualKickoff);
  assert.equal(corrected.auditHistory?.at(-1)?.newValue.actualStartedAt, correctedKickoff);
});

test("mock repository rejects actual kickoff correction for a non-admin", async () => {
  const { seasonId, match } = seedMockSeasonMatch();
  writeSession({ ...readDb().user, _id: "0000000000000000000000aa" });
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchActualKickoff(
    seasonId, match._id, { actualStartedAt: correctedKickoff, reason: "Corrected kickoff" },
  ), "UNAUTHORIZED");
});

test("mock repository rejects an invalid actual kickoff timestamp", async () => {
  const { seasonId, match } = seedMockSeasonMatch();
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchActualKickoff(
    seasonId, match._id, { actualStartedAt: "not-a-timestamp", reason: "Corrected kickoff" },
  ), "ACTUAL_KICKOFF_CORRECTION_NOT_ALLOWED");
});

test("mock repository requires a reason for actual kickoff correction", async () => {
  const { seasonId, match } = seedMockSeasonMatch();
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchActualKickoff(
    seasonId, match._id, { actualStartedAt: correctedKickoff, reason: "  " },
  ), "MATCH_AUDIT_REASON_REQUIRED");
});

test("mock repository clock correction requires an existing kickoff and a stopped clock", async () => {
  const noKickoff = seedMockSeasonMatch({ actualStartedAt: null });
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchClock(
    noKickoff.seasonId, noKickoff.match._id,
    { periodElapsedSecondsByPeriod: { firstHalf: 500 }, reason: "Correct clock" },
  ), "MATCH_CLOCK_MUST_BE_STOPPED");

  const running = seedMockSeasonMatch({
    clock: {
      isRunning: true,
      clockStartedAt: "2026-11-20T12:00:00.000Z",
      periodElapsedSecondsByPeriod: { firstHalf: 300, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  });
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchClock(
    running.seasonId, running.match._id,
    { periodElapsedSecondsByPeriod: { firstHalf: 500 }, reason: "Correct clock" },
  ), "MATCH_CLOCK_MUST_BE_STOPPED");
});

test("mock repository clock correction accepts only non-negative whole seconds", async () => {
  const { seasonId, match } = seedMockSeasonMatch();
  for (const invalid of [-1, 1.25, Number.NaN, Number.POSITIVE_INFINITY]) {
    await expectCode(() => seasonPreviewRepository.correctSeasonMatchClock(
      seasonId, match._id,
      { periodElapsedSecondsByPeriod: { firstHalf: invalid }, reason: "Correct clock" },
    ), "INVALID_MATCH_CLOCK_CORRECTION");
  }
});

test("mock repository rejects a clock correction that would place an existing goal after the clock", async () => {
  const existingGoal = goal({ minute: 12 });
  const { seasonId, match } = seedMockSeasonMatch({ goals: [existingGoal] });
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchClock(
    seasonId, match._id,
    { periodElapsedSecondsByPeriod: { firstHalf: 600 }, reason: "Correct clock" },
  ), "MATCH_CLOCK_BEFORE_EXISTING_EVENT");
});

test("mock repository rejects a clock correction that would place an existing card after the clock", async () => {
  const existingCard = card({ minute: 13 });
  const { seasonId, match } = seedMockSeasonMatch({ cards: [existingCard] });
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchClock(
    seasonId, match._id,
    { periodElapsedSecondsByPeriod: { firstHalf: 600 }, reason: "Correct clock" },
  ), "MATCH_CLOCK_BEFORE_EXISTING_EVENT");
});

test("mock repository clock correction preserves event minutes and audits previous/new clock values", async () => {
  const existingGoal = goal({ minute: 12 });
  const existingCard = card({ minute: 13 });
  const { seasonId, match } = seedMockSeasonMatch({ goals: [existingGoal], cards: [existingCard] });

  const response = await seasonPreviewRepository.correctSeasonMatchClock(
    seasonId, match._id,
    { periodElapsedSecondsByPeriod: { firstHalf: 900 }, reason: "Referee confirmed clock delay" },
  );
  assert.equal(response.data.clock.periodElapsedSecondsByPeriod.firstHalf, 900);
  assert.equal(response.data.goals[0].minute, 12);
  assert.equal(response.data.cards?.[0].minute, 13);
  assert.equal(response.data.auditHistory?.at(-1)?.action, "clock_correction");
  assert.equal(response.data.auditHistory?.at(-1)?.reason, "Referee confirmed clock delay");
  assert.equal(response.data.auditHistory?.at(-1)?.previousValue.clock?.periodElapsedSecondsByPeriod.firstHalf, 600);
  assert.equal(response.data.auditHistory?.at(-1)?.newValue.clock?.periodElapsedSecondsByPeriod.firstHalf, 900);
});

test("mock repository phase correction requires a started Live Match and a stopped clock", async () => {
  const noKickoff = seedMockSeasonMatch({ actualStartedAt: null });
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchPhase(
    noKickoff.seasonId, noKickoff.match._id, { phase: "second_half", reason: "Correct phase" },
  ), "MATCH_PHASE_CORRECTION_NOT_ALLOWED");

  const running = seedMockSeasonMatch({
    clock: {
      isRunning: true,
      clockStartedAt: "2026-11-20T12:00:00.000Z",
      periodElapsedSecondsByPeriod: { firstHalf: 300, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  });
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchPhase(
    running.seasonId, running.match._id, { phase: "second_half", reason: "Correct phase" },
  ), "MATCH_PHASE_CORRECTION_NOT_ALLOWED");
});

test("mock repository rejects invalid phase values at runtime", async () => {
  const { seasonId, match } = seedMockSeasonMatch({ phase: "regular_full_time" });
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchPhase(
    seasonId, match._id, { phase: "regular_full_time_typo" as never, reason: "Correct phase" },
  ), "INVALID_MATCH_PHASE");
});

test("mock repository Group Stage cannot be corrected into Extra Time or Penalty Shootout", async () => {
  const { seasonId, match } = seedMockSeasonMatch({
    stage: "group",
    phase: "regular_full_time",
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 900, secondHalf: 900, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  });
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchPhase(
    seasonId, match._id, { phase: "extra_time_first_half", reason: "Correct phase" },
  ), "EXTRA_TIME_DISABLED");
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchPhase(
    seasonId, match._id, { phase: "penalty_shootout", reason: "Correct phase" },
  ), "SHOOTOUT_NOT_ALLOWED");
});

test("mock repository rejects disabled deciding stages during phase correction", async () => {
  const { seasonId, match } = seedMockSeasonMatch({
    stage: "final",
    phase: "regular_full_time",
    decidingRules: {
      extraTime: { isAllowed: false, durationMinutes: 10 },
      penaltyShootout: { isAllowed: false },
    },
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 900, secondHalf: 900, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  });
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchPhase(
    seasonId, match._id, { phase: "extra_time_first_half", reason: "Correct phase" },
  ), "EXTRA_TIME_DISABLED");
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchPhase(
    seasonId, match._id, { phase: "penalty_shootout", reason: "Correct phase" },
  ), "SHOOTOUT_NOT_ALLOWED");
});

test("mock repository prevents correcting phase before elapsed time or events in a later period", async () => {
  const elapsed = seedMockSeasonMatch({
    phase: "extra_time_second_half",
    decidingRules: {
      extraTime: { isAllowed: true, durationMinutes: 10 },
      penaltyShootout: { isAllowed: true },
    },
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 900, secondHalf: 900, extraTimeFirstHalf: 120, extraTimeSecondHalf: 60 },
    },
  });
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchPhase(
    elapsed.seasonId, elapsed.match._id, { phase: "second_half", reason: "Correct phase" },
  ), "MATCH_PHASE_BEFORE_CLOCK");

  const laterEvent = seedMockSeasonMatch({
    phase: "extra_time_first_half",
    decidingRules: {
      extraTime: { isAllowed: true, durationMinutes: 10 },
      penaltyShootout: { isAllowed: true },
    },
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 900, secondHalf: 900, extraTimeFirstHalf: 120, extraTimeSecondHalf: 0 },
    },
    goals: [goal({ period: "extra_time_first_half", minute: 32 })],
  });
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchPhase(
    laterEvent.seasonId, laterEvent.match._id, { phase: "second_half", reason: "Correct phase" },
  ), "MATCH_PHASE_BEFORE_EVENT");
});

test("mock repository phase correction requires a reason and records previous/new phase", async () => {
  const { seasonId, match } = seedMockSeasonMatch({
    phase: "regular_full_time",
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 900, secondHalf: 900, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  });
  await expectCode(() => seasonPreviewRepository.correctSeasonMatchPhase(
    seasonId, match._id, { phase: "second_half", reason: "  " },
  ), "MATCH_AUDIT_REASON_REQUIRED");

  const response = await seasonPreviewRepository.correctSeasonMatchPhase(
    seasonId, match._id, { phase: "second_half", reason: "Referee corrected the whistle phase" },
  );
  assert.equal(response.data.phase, "second_half");
  assert.equal(response.data.auditHistory?.at(-1)?.previousValue.phase, "regular_full_time");
  assert.equal(response.data.auditHistory?.at(-1)?.newValue.phase, "second_half");
  assert.equal(response.data.auditHistory?.at(-1)?.reason, "Referee corrected the whistle phase");
});

test("completed mock correction updates period and minute while preserving an existing goal identity", async () => {
  const existing = goal({ period: "first_half", minute: 8 });
  const { seasonId, match } = completedMatch({ goals: [existing] });

  const response = await seasonPreviewRepository.correctCompletedSeasonMatch(seasonId, match._id, {
    reason: "The goal belongs to the second half",
    goals: [correctionGoal(match, { period: "second_half", minute: 20, addedMinutes: 0 })],
    penaltyShootout: null,
  });
  const correctedGoal = response.data.goals[0];
  assert.equal(correctedGoal._id, existing._id);
  assert.equal(correctedGoal.period, "second_half");
  assert.equal(correctedGoal.minute, 20);
  assert.equal(correctedGoal.addedMinutes, 0);
});

test("completed mock correction updates added/stoppage time", async () => {
  const existing = goal({ period: "second_half", minute: 30, addedMinutes: 0 });
  const { seasonId, match } = completedMatch({ goals: [existing] });
  const response = await seasonPreviewRepository.correctCompletedSeasonMatch(seasonId, match._id, {
    reason: "Stoppage time was omitted",
    goals: [correctionGoal(match, { period: "second_half", minute: 30, addedMinutes: 2 })],
    penaltyShootout: null,
  });
  assert.equal(response.data.goals[0]._id, existing._id);
  assert.equal(response.data.goals[0].addedMinutes, 2);
});

test("completed mock correction adds a new timed goal with a new event identity", async () => {
  const { seasonId, match } = completedMatch();
  const response = await seasonPreviewRepository.correctCompletedSeasonMatch(seasonId, match._id, {
    reason: "A missing goal was verified",
    goals: [correctionGoal(match, { period: "first_half", minute: 12, addedMinutes: 0 })],
    penaltyShootout: null,
  });
  assert.equal(response.data.goals.length, 1);
  assert.equal(response.data.goals[0].period, "first_half");
  assert.equal(response.data.goals[0].minute, 12);
  assert.ok(response.data.goals[0]._id);
  assert.equal(response.data.eventAuditHistory?.at(-1)?.operation, "created");
});

test("completed mock correction removes an existing goal and audits its deletion", async () => {
  const existing = goal({} as MockSeasonMatch);
  const { seasonId, match } = completedMatch({ goals: [existing] });
  const response = await seasonPreviewRepository.correctCompletedSeasonMatch(seasonId, match._id, {
    reason: "The original event was incorrectly recorded",
    goals: [],
    penaltyShootout: null,
  });
  assert.equal(response.data.goals.length, 0);
  const deleted = response.data.eventAuditHistory?.find((entry) => entry.eventId === existing._id && entry.operation === "deleted");
  assert.ok(deleted);
  assert.equal(deleted.previousValue?.eventType, "goal");
  assert.equal(deleted.newValue, null);
});

test("completed mock correction preserves omitted timing fields like the real API", async () => {
  const legacy = goal({ period: null, minute: null, addedMinutes: undefined });
  const { seasonId, match } = completedMatch({ goals: [legacy] });
  const response = await seasonPreviewRepository.correctCompletedSeasonMatch(seasonId, match._id, {
    reason: "Confirm a historical untimed goal",
    goals: [correctionGoal(match)],
    penaltyShootout: null,
  });
  assert.equal(response.data.goals[0]._id, legacy._id);
  assert.equal(response.data.goals[0].period, null);
  assert.equal(response.data.goals[0].minute, null);
  assert.equal(response.data.goals[0].addedMinutes, undefined);
});

test("completed mock correction rejects invalid period/minute and added-time values", async () => {
  const { seasonId, match } = completedMatch();
  await expectCode(() => seasonPreviewRepository.correctCompletedSeasonMatch(seasonId, match._id, {
    reason: "Reject impossible event time",
    goals: [correctionGoal(match, { period: "first_half", minute: 16, addedMinutes: 0 })],
    penaltyShootout: null,
  }), "INVALID_MATCH_EVENT_TIME");

  await expectCode(() => seasonPreviewRepository.correctCompletedSeasonMatch(seasonId, match._id, {
    reason: "Reject invalid added time",
    goals: [correctionGoal(match, { period: "first_half", minute: 10, addedMinutes: 1 })],
    penaltyShootout: null,
  }), "INVALID_MATCH_EVENT_ADDED_TIME");
});

test("completed mock correction preserves kickoff, actual kickoff and every clock value", async () => {
  const existing = goal({} as MockSeasonMatch);
  const { seasonId, match } = completedMatch({ goals: [existing] });
  const kickoffAt = match.kickoffAt;
  const actualStartedAt = match.actualStartedAt;
  const clock = structuredClone(match.clock);

  const response = await seasonPreviewRepository.correctCompletedSeasonMatch(seasonId, match._id, {
    reason: "Correct goal timing only",
    goals: [correctionGoal(match, { period: "first_half", minute: 9, addedMinutes: 0 })],
    penaltyShootout: null,
  });
  assert.equal(response.data.kickoffAt, kickoffAt);
  assert.equal(response.data.actualStartedAt, actualStartedAt);
  assert.deepEqual(response.data.clock, clock);
});

test("completed mock correction returns matching original/corrected timing snapshots and event audit", async () => {
  const existing = goal({ period: "first_half", minute: 8, addedMinutes: 0 });
  const { seasonId, match } = completedMatch({ goals: [existing] });
  const response = await seasonPreviewRepository.correctCompletedSeasonMatch(seasonId, match._id, {
    reason: "Correct the recorded match timeline",
    goals: [correctionGoal(match, { period: "first_half", minute: 10, addedMinutes: 1 })],
    penaltyShootout: null,
  });

  const history = response.data.correctionHistory?.at(-1);
  assert.ok(history);
  assert.equal(history.originalResult.goals[0]._id, existing._id);
  assert.equal(history.originalResult.goals[0].period, "first_half");
  assert.equal(history.originalResult.goals[0].minute, 8);
  assert.equal(history.originalResult.goals[0].addedMinutes, 0);
  assert.equal(history.correctedResult.goals[0]._id, existing._id);
  assert.equal(history.correctedResult.goals[0].period, "first_half");
  assert.equal(history.correctedResult.goals[0].minute, 10);
  assert.equal(history.correctedResult.goals[0].addedMinutes, 1);
  assert.equal(history.originalResult.homeScore, 1);
  assert.equal(history.correctedResult.homeScore, 1);

  const audit = response.data.eventAuditHistory?.at(-1);
  assert.equal(audit?.eventId, existing._id);
  assert.equal(audit?.operation, "updated");
  assert.equal(audit?.previousValue && "minute" in audit.previousValue ? audit.previousValue.minute : null, 8);
  assert.equal(audit?.newValue && "minute" in audit.newValue ? audit.newValue.minute : null, 10);
});
