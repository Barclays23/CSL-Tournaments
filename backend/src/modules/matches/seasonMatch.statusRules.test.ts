import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import { SeasonMatchService } from "./seasonMatch.service.js";
import type { SeasonMatchRepository } from "./seasonMatch.repository.js";
import type { SeasonMatchStatus } from "./seasonMatch.types.js";
import {
  assertMatchStatusTransition,
  isAllowedMatchStatusTransition,
  MATCH_STATUS_TRANSITIONS,
} from "./seasonMatch.statusRules.js";

const statuses = Object.keys(MATCH_STATUS_TRANSITIONS) as SeasonMatchStatus[];

test("match status transition matrix allows only the specified transitions", () => {
  for (const currentStatus of statuses) {
    assert.equal(isAllowedMatchStatusTransition(currentStatus, currentStatus), true);

    for (const nextStatus of statuses) {
      const expected = currentStatus === nextStatus
        || MATCH_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);

      assert.equal(
        isAllowedMatchStatusTransition(currentStatus, nextStatus),
        expected,
        `Unexpected transition result for ${currentStatus} -> ${nextStatus}`,
      );

      if (expected) {
        assert.doesNotThrow(() => assertMatchStatusTransition(currentStatus, nextStatus));
      } else {
        assert.throws(
          () => assertMatchStatusTransition(currentStatus, nextStatus),
          (error: unknown) => error instanceof AppError
            && error.statusCode === 409
            && error.errorCode === "INVALID_MATCH_STATUS_TRANSITION",
        );
      }
    }
  }
});

test("scheduled matches cannot be completed directly", () => {
  assert.throws(
    () => assertMatchStatusTransition("scheduled", "completed"),
    (error: unknown) => error instanceof AppError
      && error.message === "Cannot change match status from Scheduled to Completed. Allowed next statuses: Live, Postponed, Cancelled.",
  );
});

function serviceForStatus(status: SeasonMatchStatus): SeasonMatchService {
  const repository = {
    findById: async () => ({
      seasonRef: new Types.ObjectId("507f1f77bcf86cd799439012"),
      status,
    }),
    findSeason: async () => ({ status: "active" }),
  };

  return new SeasonMatchService(repository as unknown as SeasonMatchRepository);
}

test("generic match update API cannot reopen cancelled or abandoned matches", async () => {
  const cases: Array<{ current: "cancelled" | "abandoned"; next: SeasonMatchStatus }> = [
    { current: "cancelled", next: "scheduled" },
    { current: "abandoned", next: "live" },
  ];

  for (const { current, next } of cases) {
    const service = serviceForStatus(current);

    await assert.rejects(
      () => service.update("507f1f77bcf86cd799439011", { status: next }),
      (error: unknown) => error instanceof AppError
        && error.statusCode === 409
        && error.errorCode === "INVALID_MATCH_STATUS_TRANSITION",
    );
  }
});

test("generic match update API rejects direct scheduled-to-completed changes", async () => {
  const service = serviceForStatus("scheduled");

  await assert.rejects(
    () => service.update("507f1f77bcf86cd799439011", { status: "completed" }),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "INVALID_MATCH_STATUS_TRANSITION"
      && error.message.includes("Scheduled to Completed"),
  );
});
