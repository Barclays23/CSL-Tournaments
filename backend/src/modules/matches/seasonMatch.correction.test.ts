import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import { SeasonMatchService } from "./seasonMatch.service.js";
import type { SeasonMatchRepository } from "./seasonMatch.repository.js";
import type { SeasonMatchEntity, SeasonMatchFields } from "./seasonMatch.types.js";

const ids = {
  match: "507f1f77bcf86cd799439011",
  season: "507f1f77bcf86cd799439012",
  home: "507f1f77bcf86cd799439013",
  away: "507f1f77bcf86cd799439014",
  player: "507f1f77bcf86cd799439015",
  admin: "507f1f77bcf86cd799439016",
};

function completedMatch(overrides: Partial<SeasonMatchEntity> = {}): SeasonMatchEntity {
  const home = new Types.ObjectId(ids.home);
  const away = new Types.ObjectId(ids.away);
  const player = new Types.ObjectId(ids.player);
  return {
    _id: new Types.ObjectId(ids.match),
    seasonRef: new Types.ObjectId(ids.season),
    matchNumber: 1,
    roundNumber: 1,
    stage: "group",
    groupRef: new Types.ObjectId("507f1f77bcf86cd799439017"),
    kickoffAt: new Date("2026-10-01T12:00:00.000Z"),
    venueRef: new Types.ObjectId("507f1f77bcf86cd799439018"),
    homeSeasonTeamRef: home,
    awaySeasonTeamRef: away,
    status: "completed",
    goals: [{
      _id: new Types.ObjectId("507f1f77bcf86cd799439019"),
      scoringSeasonTeamRef: home,
      scorerPlayerRef: player,
      playerSeasonTeamRef: home,
      goalType: "normal",
      createdAt: new Date("2026-10-01T12:30:00.000Z"),
    }],
    penaltyShootout: null,
    winnerSeasonTeamRef: home,
    notes: null,
    resolutionHistory: [],
    statusHistory: [],
    correctionHistory: [],
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    updatedAt: new Date("2026-10-01T13:00:00.000Z"),
    ...overrides,
  };
}

function serviceFor(match = completedMatch()) {
  let persistedHistory: unknown;
  let persistedGoals: unknown;
  const repository = {
    findById: async () => match,
    findSeason: async () => ({
      status: "active",
      matchRules: { groupStageDrawAllowed: true, knockoutDrawRequiresShootout: true },
      pointsRules: { win: 3, draw: 1, loss: 0 },
    }),
    findPlayer: async () => ({ status: "active" }),
    findSoldLot: async () => ({ seasonTeamRef: new Types.ObjectId(ids.home) }),
    correctCompletedMatch: async (_id: string, _updatedAt: Date, goals: unknown, _shootout: unknown, _winner: unknown, history: unknown) => {
      persistedGoals = goals;
      persistedHistory = history;
      return match;
    },
    findPopulatedById: async () => ({
      ...match,
      goals: [],
      homeSeasonTeamRef: match.homeSeasonTeamRef,
      awaySeasonTeamRef: match.awaySeasonTeamRef,
      venueRef: match.venueRef,
      winnerSeasonTeamRef: null,
    }),
  };
  return {
    service: new SeasonMatchService(repository as unknown as SeasonMatchRepository),
    getHistory: () => persistedHistory as any,
    getGoals: () => persistedGoals as any,
  };
}

test("completed match correction requires an authenticated admin identity and reason", async () => {
  const { service } = serviceFor();
  await assert.rejects(
    () => service.correctCompletedMatch(ids.match, { reason: "Fix score", goals: [], penaltyShootout: null }),
    (error: unknown) => error instanceof AppError && error.errorCode === "FORBIDDEN",
  );
  await assert.rejects(
    () => service.correctCompletedMatch(ids.match, { reason: "  ", goals: [], penaltyShootout: null }, ids.admin),
    (error: unknown) => error instanceof AppError && error.errorCode === "MATCH_CORRECTION_REASON_REQUIRED",
  );
});

test("only completed matches can be corrected", async () => {
  const { service } = serviceFor(completedMatch({ status: "live" }));
  await assert.rejects(
    () => service.correctCompletedMatch(ids.match, { reason: "Correct result", goals: [], penaltyShootout: null }, ids.admin),
    (error: unknown) => error instanceof AppError && error.errorCode === "MATCH_NOT_COMPLETED",
  );
});

test("correction revalidates the result and records original and corrected snapshots", async () => {
  const original = completedMatch();
  const { service, getHistory, getGoals } = serviceFor(original);
  await service.correctCompletedMatch(ids.match, {
    reason: "The original goal was incorrectly awarded.",
    goals: [],
    penaltyShootout: null,
  }, ids.admin);

  const history = getHistory();
  assert.equal(history.reason, "The original goal was incorrectly awarded.");
  assert.equal(String(history.correctedBy), ids.admin);
  assert.ok(history.correctedAt instanceof Date);
  assert.equal(history.originalResult.homeScore, 1);
  assert.equal(history.originalResult.awayScore, 0);
  assert.equal(history.correctedResult.homeScore, 0);
  assert.equal(history.correctedResult.awayScore, 0);
  assert.equal(history.originalResult.goals.length, 1);
  assert.equal(history.correctedResult.goals.length, 0);
  assert.equal(getGoals().length, 0);
});

test("knockout correction must satisfy the configured penalty shootout rules", async () => {
  const knockout = completedMatch({ stage: "final", groupRef: null });
  const { service } = serviceFor(knockout);
  await assert.rejects(
    () => service.correctCompletedMatch(ids.match, {
      reason: "Correct the recorded final score",
      goals: [],
      penaltyShootout: null,
    }, ids.admin),
    (error: unknown) => error instanceof AppError && error.errorCode === "SHOOTOUT_REQUIRED",
  );
});

test("ordinary goal CRUD and generic updates remain unavailable for completed matches", async () => {
  const { service } = serviceFor();
  const goalId = "507f1f77bcf86cd799439019";
  const goal = { scoringSeasonTeamRef: ids.home, scorerPlayerRef: ids.player, goalType: "normal" as const };
  await assert.rejects(() => service.addGoal(ids.match, goal), (e: unknown) => e instanceof AppError && e.errorCode === "MATCH_GOAL_MANAGEMENT_NOT_ALLOWED");
  await assert.rejects(() => service.updateGoal(ids.match, goalId, goal), (e: unknown) => e instanceof AppError && e.errorCode === "MATCH_GOAL_MANAGEMENT_NOT_ALLOWED");
  await assert.rejects(() => service.deleteGoal(ids.match, goalId), (e: unknown) => e instanceof AppError && e.errorCode === "MATCH_GOAL_MANAGEMENT_NOT_ALLOWED");
  await assert.rejects(() => service.update(ids.match, { notes: "Bypass attempt" }), (e: unknown) => e instanceof AppError && e.errorCode === "MATCH_COMPLETED_READ_ONLY");
});
