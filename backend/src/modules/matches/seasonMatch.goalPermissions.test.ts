import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import { SeasonMatchService } from "./seasonMatch.service.js";
import type { SeasonMatchRepository } from "./seasonMatch.repository.js";
import type { SeasonMatchEntity, SeasonMatchStatus } from "./seasonMatch.types.js";

const matchId = "507f1f77bcf86cd799439011";
const goalId = "507f1f77bcf86cd799439018";
const statuses: SeasonMatchStatus[] = [
  "scheduled", "live", "postponed", "completed", "cancelled", "abandoned",
];

function makeMatch(status: SeasonMatchStatus, goals: unknown[] = [], cards: unknown[] = []): SeasonMatchEntity {
  return {
    _id: new Types.ObjectId(matchId),
    seasonRef: new Types.ObjectId("507f1f77bcf86cd799439012"),
    matchNumber: 1,
    roundNumber: 1,
    stage: "group",
    groupRef: new Types.ObjectId("507f1f77bcf86cd799439015"),
    kickoffAt: new Date("2027-01-01T12:00:00.000Z"),
    venueRef: new Types.ObjectId("507f1f77bcf86cd799439016"),
    homeSeasonTeamRef: new Types.ObjectId("507f1f77bcf86cd799439013"),
    awaySeasonTeamRef: new Types.ObjectId("507f1f77bcf86cd799439014"),
    status,
    goals: goals as SeasonMatchEntity["goals"],
    penaltyShootout: null,
    winnerSeasonTeamRef: null,
    notes: null,
    resolutionHistory: [],
    statusHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...({ cards } as object),
  } as SeasonMatchEntity;
}

function makeService(match: SeasonMatchEntity): SeasonMatchService {
  const repository = {
    findById: async () => match,
    findSeason: async () => ({ status: "active" }),
  };
  return new SeasonMatchService(repository as unknown as SeasonMatchRepository);
}

const goalInput = {
  scoringSeasonTeamRef: "507f1f77bcf86cd799439013",
  scorerPlayerRef: "507f1f77bcf86cd799439019",
  goalType: "normal" as const,
};

test("goal creation, editing and deletion are rejected for every non-Live status", async () => {
  for (const status of statuses.filter((value) => value !== "live")) {
    const match = makeMatch(status, [{ _id: new Types.ObjectId(goalId) }]);
    const service = makeService(match);
    for (const [operation, run] of [
      ["create", () => service.addGoal(matchId, goalInput)],
      ["edit", () => service.updateGoal(matchId, goalId, goalInput)],
      ["delete", () => service.deleteGoal(matchId, goalId)],
    ] as const) {
      await assert.rejects(run, (error: unknown) =>
        error instanceof AppError
        && error.statusCode === 409
        && error.errorCode === "MATCH_GOAL_MANAGEMENT_NOT_ALLOWED",
        `${operation} must be blocked for ${status}`,
      );
    }
  }
});

test("Live status is the only status accepted by the goal permission guard", async () => {
  const service = makeService(makeMatch("live"));
  const internal = service as unknown as {
    assertGoalManagementAllowed: (match: SeasonMatchEntity) => void;
  };
  assert.doesNotThrow(() => internal.assertGoalManagementAllowed(makeMatch("live")));
  for (const status of statuses.filter((value) => value !== "live")) {
    assert.throws(
      () => internal.assertGoalManagementAllowed(makeMatch(status)),
      (error: unknown) => error instanceof AppError
        && error.errorCode === "MATCH_GOAL_MANAGEMENT_NOT_ALLOWED",
    );
  }
});

test("match details cannot be edited after goals or cards exist", async () => {
  for (const status of ["scheduled", "live"] as const) {
    for (const eventKind of ["goal", "card"] as const) {
      const match = makeMatch(status, eventKind === "goal" ? [{}] : [], eventKind === "card" ? [{}] : []);
      const service = makeService(match);
      await assert.rejects(
        () => service.update(matchId, { notes: "Updated venue details" }),
        (error: unknown) => error instanceof AppError
          && error.statusCode === 409
          && error.errorCode === "MATCH_HAS_EVENTS",
        `A ${status} match with a ${eventKind} must not be editable`,
      );
    }
  }
});

test("match details are not editable in Postponed, Completed, Cancelled or Abandoned statuses", async () => {
  for (const status of ["postponed", "completed", "cancelled", "abandoned"] as const) {
    const service = makeService(makeMatch(status));
    await assert.rejects(
      () => service.update(matchId, { notes: "Attempted edit" }),
      (error: unknown) => error instanceof AppError
        && error.statusCode === 409
        && error.errorCode === "MATCH_DETAILS_EDIT_NOT_ALLOWED",
      `Match details must not be editable for ${status}`,
    );
  }
});
