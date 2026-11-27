import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import { calculateCompletedMatchWinner } from "./seasonMatch.completionRules.js";
import { SeasonMatchService } from "./seasonMatch.service.js";
import type { SeasonMatchRepository } from "./seasonMatch.repository.js";
import type { SeasonMatchFields, SeasonGoalFields, SeasonPenaltyShootout } from "./seasonMatch.types.js";

const home = new Types.ObjectId("507f1f77bcf86cd799439011");
const away = new Types.ObjectId("507f1f77bcf86cd799439012");
const player = new Types.ObjectId("507f1f77bcf86cd799439013");
const outsider = new Types.ObjectId("507f1f77bcf86cd799439014");

const matchRules = {
  groupStageDrawAllowed: true,
  knockoutDrawRequiresShootout: true,
};
const pointsRules = { win: 3, draw: 1, loss: 0 };

function normalGoal(team: Types.ObjectId): SeasonGoalFields {
  return {
    scoringSeasonTeamRef: team,
    scorerPlayerRef: player,
    playerSeasonTeamRef: team,
    goalType: "normal",
  };
}

function completedMatch(
  overrides: Partial<SeasonMatchFields> = {},
): Pick<SeasonMatchFields,"status"|"stage"|"homeSeasonTeamRef"|"awaySeasonTeamRef"|"goals"|"penaltyShootout"> & Partial<Pick<SeasonMatchFields,"phase"|"decidingRules">> {
  return {
    status: "completed",
    stage: "group",
    homeSeasonTeamRef: home,
    awaySeasonTeamRef: away,
    goals: [],
    penaltyShootout: null,
    ...overrides,
  };
}

function shootout(
  overrides: Partial<SeasonPenaltyShootout> = {},
): SeasonPenaltyShootout {
  return {
    status: "completed",
    homeTeamScore: 4,
    awayTeamScore: 3,
    kicks: [],
    ...overrides,
  };
}

function getErrorCode(work: () => unknown, code: string): void {
  assert.throws(
    work,
    (error: unknown) => error instanceof AppError && error.errorCode === code,
  );
}

test("valid group-stage completion calculates the winner from recorded goal events", () => {
  const winner = calculateCompletedMatchWinner(
    completedMatch({ goals: [normalGoal(home), normalGoal(home), normalGoal(away)] }),
    matchRules,
    pointsRules,
  );

  assert.equal(winner, String(home));
});

test("an incomplete or inconsistent goal record blocks match completion", () => {
  getErrorCode(
    () => calculateCompletedMatchWinner(
      completedMatch({
        goals: [{
          scoringSeasonTeamRef: home,
          scorerPlayerRef: null,
          playerSeasonTeamRef: null,
          goalType: "normal",
        }],
      }),
      matchRules,
      pointsRules,
    ),
    "MATCH_SCORE_INVALID",
  );

  getErrorCode(
    () => calculateCompletedMatchWinner(
      completedMatch({ goals: [normalGoal(outsider)] }),
      matchRules,
      pointsRules,
    ),
    "MATCH_SCORE_INVALID",
  );

  getErrorCode(
    () => calculateCompletedMatchWinner(
      completedMatch({ goals: undefined as unknown as SeasonGoalFields[] }),
      matchRules,
      pointsRules,
    ),
    "MATCH_RESULT_INCOMPLETE",
  );
});

test("group-stage draws are accepted or rejected using the season match and points rules", () => {
  const draw = completedMatch({ goals: [normalGoal(home), normalGoal(away)] });

  assert.equal(calculateCompletedMatchWinner(draw, matchRules, pointsRules), null);

  getErrorCode(
    () => calculateCompletedMatchWinner(
      draw,
      { ...matchRules, groupStageDrawAllowed: false },
      pointsRules,
    ),
    "GROUP_DRAW_NOT_ALLOWED",
  );

  getErrorCode(
    () => calculateCompletedMatchWinner(draw, matchRules, null),
    "SEASON_POINTS_RULES_UNAVAILABLE",
  );
});

test("a valid knockout win without a shootout is accepted", () => {
  assert.equal(
    calculateCompletedMatchWinner(
      completedMatch({
        stage: "final",
        goals: [normalGoal(home)],
      }),
      matchRules,
      pointsRules,
    ),
    String(home),
  );
});

test("a tied knockout match requires a completed shootout when configured", () => {
  getErrorCode(
    () => calculateCompletedMatchWinner(
      completedMatch({ stage:"semi_final",goals:[normalGoal(home),normalGoal(away)],decidingRules:{extraTime:{isAllowed:false,durationMinutes:10},penaltyShootout:{isAllowed:true}}}),
      matchRules,pointsRules),
    "SHOOTOUT_REQUIRED",
  );
});

test("a knockout draw can remain unresolved only when the season does not require a shootout", () => {
  assert.equal(
    calculateCompletedMatchWinner(
      completedMatch({ stage: "semi_final", goals: [normalGoal(home), normalGoal(away)] }),
      matchRules,
      pointsRules,
    ),
    null,
  );
});

test("a valid knockout shootout determines the winner without changing normal-time score", () => {
  const recordedShootout = shootout({
    homeTeamScore: 4,
    awayTeamScore: 3,
    kicks: [
      ...Array.from({ length: 4 }, () => ({ seasonTeamRef: home, playerRef: player, result: "scored" as const })),
      ...Array.from({ length: 3 }, () => ({ seasonTeamRef: away, playerRef: player, result: "scored" as const })),
    ],
  });

  assert.equal(
    calculateCompletedMatchWinner(
      completedMatch({
        stage: "final",
        goals: [normalGoal(home), normalGoal(away)],
        penaltyShootout:recordedShootout,decidingRules:{extraTime:{isAllowed:false,durationMinutes:10},penaltyShootout:{isAllowed:true}},
      }),
      matchRules,
      pointsRules,
    ),
    String(home),
  );
});

test("invalid completed shootouts are rejected when tied or inconsistent with successful kicks", () => {
  getErrorCode(
    () => calculateCompletedMatchWinner(
      completedMatch({
        stage: "final",
        goals: [normalGoal(home), normalGoal(away)],
        penaltyShootout:shootout({homeTeamScore:3,awayTeamScore:3}),decidingRules:{extraTime:{isAllowed:false,durationMinutes:10},penaltyShootout:{isAllowed:true}},
      }),
      matchRules,
      pointsRules,
    ),
    "SHOOTOUT_TIED",
  );

  getErrorCode(
    () => calculateCompletedMatchWinner(
      completedMatch({
        stage: "final",
        goals: [normalGoal(home), normalGoal(away)],
        penaltyShootout: shootout({
          homeTeamScore: 4,
          awayTeamScore: 3,
          kicks: [
            ...Array.from({ length: 3 }, () => ({ seasonTeamRef: home, playerRef: player, result: "scored" as const })),
            ...Array.from({ length: 3 }, () => ({ seasonTeamRef: away, playerRef: player, result: "scored" as const })),
          ],
        }),
      }),
      matchRules,
      pointsRules,
    ),
    "SHOOTOUT_SCORE_MISMATCH",
  );
});

test("shootout scores must be non-negative whole numbers", () => {
  getErrorCode(
    () => calculateCompletedMatchWinner(
      completedMatch({
        stage: "final",
        goals: [normalGoal(home), normalGoal(away)],
        penaltyShootout: shootout({ homeTeamScore: -1 }),
      }),
      matchRules,
      pointsRules,
    ),
    "SHOOTOUT_SCORE_INVALID",
  );
});

function serviceForStatus(status: "scheduled" | "postponed"): SeasonMatchService {
  const repository = {
    findById: async () => ({
      seasonRef: new Types.ObjectId("507f1f77bcf86cd799439015"),
      status,
    }),
    findSeason: async () => ({ status: "active" }),
  };

  return new SeasonMatchService(repository as unknown as SeasonMatchRepository);
}

test("Scheduled and Postponed fixtures cannot be completed directly", async () => {
  for (const status of ["scheduled", "postponed"] as const) {
    await assert.rejects(
      () => serviceForStatus(status).update("507f1f77bcf86cd799439016", { status: "completed" }),
      (error: unknown) => error instanceof AppError
        && error.errorCode === "INVALID_MATCH_STATUS_TRANSITION",
    );
  }
});
