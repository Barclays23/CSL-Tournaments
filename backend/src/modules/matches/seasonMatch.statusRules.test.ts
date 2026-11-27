import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../shared/errors/appError.js";
import type { SeasonMatchStatus } from "./seasonMatch.types.js";
import {
  assertMatchStatusTransition,
  isAllowedMatchStatusTransition,
  MATCH_STATUS_TRANSITIONS,
} from "./seasonMatch.statusRules.js";
import { seasonMatchUpdateSchema, matchStatusActionSchema } from "./seasonMatch.schema.js";

const statuses = Object.keys(MATCH_STATUS_TRANSITIONS) as SeasonMatchStatus[];

test("match status transition matrix allows only permitted lifecycle transitions", () => {
  for (const currentStatus of statuses) {
    assert.equal(isAllowedMatchStatusTransition(currentStatus, currentStatus), true);
    for (const nextStatus of statuses) {
      const expected = currentStatus === nextStatus || MATCH_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
      assert.equal(isAllowedMatchStatusTransition(currentStatus, nextStatus), expected, `${currentStatus} -> ${nextStatus}`);
      if (expected) assert.doesNotThrow(() => assertMatchStatusTransition(currentStatus, nextStatus));
      else assert.throws(() => assertMatchStatusTransition(currentStatus, nextStatus),
        (error: unknown) => error instanceof AppError && error.statusCode === 409 && error.errorCode === "INVALID_MATCH_STATUS_TRANSITION");
    }
  }
});

test("Live matches cannot be reset to Scheduled through a status transition", () => {
  assert.equal(MATCH_STATUS_TRANSITIONS.live.includes("scheduled"), false);
  assert.throws(() => assertMatchStatusTransition("live", "scheduled"),
    (error: unknown) => error instanceof AppError && error.errorCode === "INVALID_MATCH_STATUS_TRANSITION");
});

test("a started Postponed match may only resume through the dedicated resume action or be abandoned", () => {
  assert.equal(MATCH_STATUS_TRANSITIONS.postponed.includes("live"), true);
  assert.equal(MATCH_STATUS_TRANSITIONS.postponed.includes("abandoned"), true);
  assert.throws(() => assertMatchStatusTransition("completed", "live"),
    (error: unknown) => error instanceof AppError && error.errorCode === "INVALID_MATCH_STATUS_TRANSITION");
});

test("Completed, Cancelled and Abandoned statuses are terminal", () => {
  for (const status of ["completed", "cancelled", "abandoned"] as const) {
    for (const next of statuses) {
      if (next === status) continue;
      assert.throws(() => assertMatchStatusTransition(status, next),
        (error: unknown) => error instanceof AppError && error.errorCode === "INVALID_MATCH_STATUS_TRANSITION");
    }
  }
});

test("generic fixture updates cannot change status, phase, clock, deciding rules or shootout", () => {
  for (const field of ["status", "phase", "clock", "decidingRules", "penaltyShootout", "actualStartedAt"]) {
    assert.equal(seasonMatchUpdateSchema.safeParse({ [field]: field === "status" ? "live" : {} }).success, false, field);
  }
});

test("status endpoint accepts reasoned actions but cannot directly complete a match", () => {
  assert.equal(matchStatusActionSchema.safeParse({ action: "postpone", reason: "Severe weather" }).success, true);
  assert.equal(matchStatusActionSchema.safeParse({ action: "cancel", reason: "Venue unavailable" }).success, true);
  assert.equal(matchStatusActionSchema.safeParse({ action: "abandon", reason: "Unsafe conditions" }).success, true);
  assert.equal(matchStatusActionSchema.safeParse({ action: "resume" }).success, true);
  assert.equal(matchStatusActionSchema.safeParse({ action: "completed" }).success, false);
  assert.equal(matchStatusActionSchema.safeParse({ action: "postpone" }).success, false);
});
