import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import { SeasonMatchService } from "./seasonMatch.service.js";
import type { SeasonMatchRepository } from "./seasonMatch.repository.js";
import type { MatchAuditHistoryEntry, SeasonMatchEntity, SeasonMatchFields } from "./seasonMatch.types.js";

const matchId = "507f1f77bcf86cd799439011";
const seasonId = "507f1f77bcf86cd799439012";
const homeId = "507f1f77bcf86cd799439013";
const awayId = "507f1f77bcf86cd799439014";
const actorId = "507f1f77bcf86cd799439017";

function createMatch(overrides: Partial<SeasonMatchEntity> = {}): SeasonMatchEntity {
  return {
    _id: new Types.ObjectId(matchId),
    seasonRef: new Types.ObjectId(seasonId),
    matchNumber: 1,
    roundNumber: 1,
    stage: "group",
    groupRef: new Types.ObjectId("507f1f77bcf86cd799439015"),
    kickoffAt: new Date("2026-11-28T12:00:00.000Z"),
    venueRef: new Types.ObjectId("507f1f77bcf86cd799439016"),
    homeSeasonTeamRef: new Types.ObjectId(homeId),
    awaySeasonTeamRef: new Types.ObjectId(awayId),
    status: "live",
    matchDurationMinutes: 30,
    decidingRules: { extraTime: { isAllowed: false, durationMinutes: 10 }, penaltyShootout: { isAllowed: false } },
    actualStartedAt: new Date("2026-11-28T12:00:00.000Z"),
    phase: "first_half",
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 90, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
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
    createdAt: new Date("2026-11-28T11:00:00.000Z"),
    updatedAt: new Date("2026-11-28T13:00:00.000Z"),
    ...overrides,
  };
}

interface Harness {
  service: SeasonMatchService;
  writes: Array<{ set: Partial<SeasonMatchFields>; audit: MatchAuditHistoryEntry }>;
  document: () => SeasonMatchEntity;
}

function makeHarness(initial = createMatch(), seasonStatus: "active" | "completed" | "archived" = "active"): Harness {
  let document = initial;
  const writes: Harness["writes"] = [];
  const season = { status: seasonStatus };
  const repository = {
    findById: async () => document,
    findSeason: async () => season,
    findPopulatedById: async () => document,
    applyOperationalUpdate: async (
      _id: string,
      _expectedUpdatedAt: Date,
      set: Partial<SeasonMatchFields>,
      audit: MatchAuditHistoryEntry,
    ) => {
      writes.push({ set, audit });
      const changedStatus = set.status !== undefined && set.status !== document.status;
      document = {
        ...document,
        ...set,
        statusHistory: changedStatus ? [...(document.statusHistory ?? []), {
          fromStatus: document.status,
          toStatus: set.status!,
          reason: audit.reason,
          changedBy: audit.actor,
          changedAt: audit.timestamp,
          fromKickoffAt: document.kickoffAt,
          toKickoffAt: set.kickoffAt ?? document.kickoffAt,
        }] : document.statusHistory,
        auditHistory: [...(document.auditHistory ?? []), audit],
        updatedAt: new Date(),
      };
      return document;
    },
  };
  return {
    service: new SeasonMatchService(repository as unknown as SeasonMatchRepository),
    writes,
    document: () => document,
  };
}

test("status operations audit actor, timestamp, previous/new values and required reason", async () => {
  const harness = makeHarness();
  const before = Date.now();
  const response = await harness.service.changeStatus(matchId, { action: "postpone", reason: "Severe rain" }, actorId);
  const entry = harness.writes[0]?.audit;
  assert.ok(entry);
  assert.equal(entry.action, "status_change");
  assert.equal(String(entry.actor), actorId);
  assert.equal(entry.reason, "Severe rain");
  assert.equal(entry.previousValue.status, "live");
  assert.equal(entry.newValue.status, "postponed");
  assert.ok(entry.timestamp.getTime() >= before);
  assert.equal(response.statusHistory.length, 1);
  assert.equal(response.auditHistory.length, 1);
});

test("postponing a running Live match is rejected until the clock is stopped", async () => {
  const harness = makeHarness(createMatch({
    clock: {
      isRunning: true,
      clockStartedAt: new Date(Date.now() - 60_000),
      periodElapsedSecondsByPeriod: { firstHalf: 90, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  }));
  await assert.rejects(
    () => harness.service.changeStatus(matchId, { action: "postpone", reason: "Heavy rain" }, actorId),
    (error: unknown) => error instanceof AppError && error.errorCode === "MATCH_CLOCK_MUST_BE_STOPPED",
  );
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.document().status, "live");
});

test("resuming a postponed started match preserves the same phase and elapsed seconds", async () => {
  const harness = makeHarness(createMatch({
    status: "postponed",
    phase: "second_half",
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 900, secondHalf: 420, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  }));
  const response = await harness.service.changeStatus(matchId, { action: "resume" }, actorId);
  assert.equal(response.status, "live");
  assert.equal(response.phase, "second_half");
  assert.equal(response.clock.isRunning, true);
  assert.equal(response.clock.periodElapsedSecondsByPeriod.secondHalf, 420);
  assert.ok(response.clock.clockStartedAt);
  assert.equal(response.auditHistory[0].action, "status_change");
  assert.equal(response.auditHistory[0].previousValue.status, "postponed");
  assert.equal(response.auditHistory[0].newValue.status, "live");
});

test("a pre-kickoff Postponed fixture cannot resume as a Live match", async () => {
  const harness = makeHarness(createMatch({ status: "postponed", actualStartedAt: null, phase: null }));
  await assert.rejects(
    () => harness.service.changeStatus(matchId, { action: "resume" }, actorId),
    (error: unknown) => error instanceof AppError && error.errorCode === "MATCH_RESUME_NOT_ALLOWED",
  );
  assert.equal(harness.writes.length, 0);
});

test("abandonment stops a running clock, preserves elapsed time and records a reason", async () => {
  const harness = makeHarness(createMatch({
    clock: {
      isRunning: true,
      clockStartedAt: new Date(Date.now() - 30_000),
      periodElapsedSecondsByPeriod: { firstHalf: 90, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  }));
  const response = await harness.service.changeStatus(matchId, { action: "abandon", reason: "Unsafe playing surface" }, actorId);
  assert.equal(response.status, "abandoned");
  assert.equal(response.clock.isRunning, false);
  assert.equal(response.clock.clockStartedAt, null);
  assert.ok(response.clock.periodElapsedSecondsByPeriod.firstHalf >= 120);
  assert.equal(response.resolutionHistory.at(-1)?.reason, "Unsafe playing surface");
  assert.equal(response.auditHistory[0].reason, "Unsafe playing surface");
});

test("missing reason and missing actor are rejected for controlled status changes", async () => {
  const harness = makeHarness();
  await assert.rejects(
    () => harness.service.changeStatus(matchId, { action: "postpone", reason: "" }, actorId),
    (error: unknown) => error instanceof AppError && error.errorCode === "MATCH_STATUS_REASON_REQUIRED",
  );
  await assert.rejects(
    () => harness.service.changeStatus(matchId, { action: "postpone", reason: "Weather" }),
    (error: unknown) => error instanceof AppError && error.errorCode === "UNAUTHENTICATED",
  );
  assert.equal(harness.writes.length, 0);
});

test("Start Match sets actual kickoff and starts the first-half clock only once", async () => {
  const harness = makeHarness(createMatch({
    status: "scheduled",
    actualStartedAt: null,
    phase: null,
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 0, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  }));
  const response = await harness.service.startMatch(matchId, actorId);
  assert.equal(response.status, "live");
  assert.equal(response.phase, "first_half");
  assert.equal(response.clock.isRunning, true);
  assert.ok(response.actualStartedAt);
  assert.ok(response.clock.clockStartedAt);
  assert.equal(response.auditHistory[0].action, "start_match");
  assert.equal(response.auditHistory[0].previousValue.actualStartedAt, null);
  assert.equal(response.auditHistory[0].newValue.phase, "first_half");
  await assert.rejects(
    () => harness.service.startMatch(matchId, actorId),
    (error: unknown) => error instanceof AppError && error.errorCode === "MATCH_START_NOT_ALLOWED",
  );
  assert.equal(harness.writes.length, 1);
});

test("clock corrections cannot move existing goals or cards after the corrected clock", async () => {
  const goal = {
    period: "first_half" as const,
    minute: 8,
    addedMinutes: 0,
  } as unknown as SeasonMatchEntity["goals"][number];
  const card = {
    period: "first_half" as const,
    minute: 9,
    addedMinutes: 0,
  } as unknown as NonNullable<SeasonMatchEntity["cards"]>[number];
  const harness = makeHarness(createMatch({
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 600, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
    goals: [goal],
    cards: [card],
  }));
  await assert.rejects(
    () => harness.service.correctClock(matchId, {
      periodElapsedSecondsByPeriod: { firstHalf: 500 },
      reason: "Clock correction",
    }, actorId),
    (error: unknown) => error instanceof AppError && error.errorCode === "MATCH_CLOCK_BEFORE_EXISTING_EVENT",
  );
  assert.equal(harness.writes.length, 0);

  const corrected = await harness.service.correctClock(matchId, {
    periodElapsedSecondsByPeriod: { firstHalf: 700 },
    reason: "Referee confirmed clock delay",
  }, actorId);
  assert.equal(corrected.clock.periodElapsedSecondsByPeriod.firstHalf, 700);
  assert.equal(corrected.goals[0].minute, 8);
  assert.equal(corrected.cards[0].minute, 9);
  assert.equal(corrected.auditHistory[0].action, "clock_correction");
  assert.equal(corrected.auditHistory[0].reason, "Referee confirmed clock delay");
});

test("actual kickoff correction is separate from and does not change the match clock", async () => {
  const harness = makeHarness(createMatch({
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 640, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  }));
  const corrected = await harness.service.correctActualKickoff(matchId, {
    actualStartedAt: new Date(Date.now() - 90_000),
    reason: "Kickoff timestamp corrected from referee record",
  }, actorId);
  assert.equal(corrected.clock.periodElapsedSecondsByPeriod.firstHalf, 640);
  assert.equal(corrected.clock.isRunning, false);
  assert.equal(corrected.auditHistory[0].action, "actual_kickoff_correction");
});

test("a Live match with a clock segment timestamp cannot be postponed even if isRunning is inconsistent", async () => {
  const harness = makeHarness(createMatch({
    clock: {
      isRunning: false,
      clockStartedAt: new Date(),
      periodElapsedSecondsByPeriod: { firstHalf: 90, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  }));
  await assert.rejects(
    () => harness.service.changeStatus(matchId, { action: "postpone", reason: "Weather delay" }, actorId),
    (error: unknown) => error instanceof AppError && error.errorCode === "MATCH_CLOCK_MUST_BE_STOPPED",
  );
});

test("fixture schedule and identity remain locked after actual kickoff even when postponed", async () => {
  const harness = makeHarness(createMatch({
    status: "postponed",
    actualStartedAt: new Date("2026-11-28T12:00:00.000Z"),
    phase: "second_half",
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 900, secondHalf: 300, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  }));
  await assert.rejects(
    () => harness.service.update(matchId, { kickoffAt: new Date("2026-12-01T12:00:00.000Z") }, actorId),
    (error: unknown) => error instanceof AppError && error.errorCode === "FIXTURE_LOCKED_AFTER_KICKOFF",
  );
  assert.equal(harness.writes.length, 0);
});

test("Completed, Cancelled and Abandoned matches cannot be edited through fixture update", async () => {
  for (const status of ["completed", "cancelled", "abandoned"] as const) {
    const harness = makeHarness(createMatch({ status }));
    await assert.rejects(
      () => harness.service.update(matchId, { notes: "Late edit" }, actorId),
      (error: unknown) => error instanceof AppError && error.errorCode === "MATCH_TERMINAL",
    );
    assert.equal(harness.writes.length, 0);
  }
});

test("live Match operations remain available during unfinished auctions but not in read-only Seasons", async () => {
  const writable = makeHarness(createMatch(), "active");
  const paused = await writable.service.pauseClock(matchId, actorId).catch(error => error);
  // The default test fixture is paused; reaching this clock-state guard proves that
  // operational controls are not rejected by the auction lifecycle.
  assert.ok(paused instanceof AppError && paused.errorCode === "MATCH_CLOCK_NOT_RUNNING");

  const completedSeason = makeHarness(createMatch({
    clock: {
      isRunning: true,
      clockStartedAt: new Date(Date.now() - 10_000),
      periodElapsedSecondsByPeriod: { firstHalf: 60, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
    },
  }), "completed");
  await assert.rejects(
    () => completedSeason.service.pauseClock(matchId, actorId),
    (error: unknown) => error instanceof AppError && error.errorCode === "SEASON_WRITE_LOCKED",
  );
  assert.equal(completedSeason.writes.length, 0);
});
