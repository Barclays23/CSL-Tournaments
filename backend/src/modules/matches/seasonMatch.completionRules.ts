import { AppError } from "../../shared/errors/appError.js";
import type { SeasonMatchFields } from "./seasonMatch.types.js";
import type { SeasonMatchRules, SeasonPointsRules } from "../seasons/season.types.js";

export type MatchCompletionInput = Pick<
  SeasonMatchFields,
  "status" | "stage" | "homeSeasonTeamRef" | "awaySeasonTeamRef" | "goals" | "penaltyShootout"
>;

export interface MatchScore {
  homeScore: number;
  awayScore: number;
}

function referenceId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function invalidScore(message: string): never {
  throw new AppError(message, 422, "MATCH_SCORE_INVALID", { goals: message });
}

/**
 * Derives the normal-time score from embedded goal events.
 * An empty, valid goals array represents a legitimate 0-0 score.
 */
export function deriveMatchScore(match: MatchCompletionInput): MatchScore {
  const homeId = referenceId(match.homeSeasonTeamRef);
  const awayId = referenceId(match.awaySeasonTeamRef);

  if (!homeId || !awayId || homeId === awayId) {
    throw new AppError(
      "A completed match must have two different participating teams recorded.",
      422,
      "MATCH_RESULT_INCOMPLETE",
      { teams: "Both match participants must be recorded." },
    );
  }

  if (!Array.isArray(match.goals)) {
    throw new AppError(
      "The match score cannot be calculated because its goal records are missing or invalid.",
      422,
      "MATCH_RESULT_INCOMPLETE",
      { goals: "Record the match goal events before completing the fixture." },
    );
  }

  let homeScore = 0;
  let awayScore = 0;

  for (const [index, goal] of match.goals.entries()) {
    if (!goal || typeof goal !== "object") {
      invalidScore("Goal record " + (index + 1) + " is incomplete.");
    }

    const scoringTeamId = referenceId(goal.scoringSeasonTeamRef);
    if (scoringTeamId !== homeId && scoringTeamId !== awayId) {
      invalidScore("Goal record " + (index + 1) + " must credit either team participating in this match.");
    }

    const scorerId = referenceId(goal.scorerPlayerRef);
    const playerTeamId = referenceId(goal.playerSeasonTeamRef);

    if (goal.goalType === "normal") {
      if (!scorerId || playerTeamId !== scoringTeamId) {
        invalidScore(
          "Normal goal record " + (index + 1) + " must identify a scorer belonging to the team credited with the goal.",
        );
      }
    } else if (goal.goalType === "own_goal") {
      if (Boolean(scorerId) !== Boolean(playerTeamId)) {
        invalidScore(
          "Own-goal record " + (index + 1) + " must either identify both the responsible player and their team, or leave both unknown.",
        );
      }

      if (playerTeamId && playerTeamId === scoringTeamId) {
        invalidScore(
          "Own-goal record " + (index + 1) + " must identify a player from the opposing team.",
        );
      }
    } else {
      invalidScore("Goal record " + (index + 1) + " has an unsupported goal type.");
    }

    if (scoringTeamId === homeId) homeScore += 1;
    else awayScore += 1;
  }

  return { homeScore, awayScore };
}

/**
 * Validates shootout score integrity independently of database lookups.
 * When kick details are present, successful kicks must reconcile with the
 * aggregate shootout score. Empty kick lists support score-only legacy records.
 */
export function assertPenaltyShootoutScore(
  match: Pick<MatchCompletionInput, "homeSeasonTeamRef" | "awaySeasonTeamRef">,
  shootout: NonNullable<MatchCompletionInput["penaltyShootout"]>,
): void {
  const homeId = referenceId(match.homeSeasonTeamRef);
  const awayId = referenceId(match.awaySeasonTeamRef);

  if (!homeId || !awayId || homeId === awayId) {
    throw new AppError("The shootout cannot be validated because the match participants are invalid.", 422, "INVALID_SHOOTOUT_TEAMS");
  }

  const validScore = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;
  if (!validScore(shootout.homeTeamScore) || !validScore(shootout.awayTeamScore)) {
    throw new AppError(
      "Penalty shootout scores must be whole numbers greater than or equal to zero.",
      422,
      "SHOOTOUT_SCORE_INVALID",
      { penaltyShootout: "Enter valid non-negative whole-number shootout scores." },
    );
  }

  if (!Array.isArray(shootout.kicks)) {
    throw new AppError("Penalty shootout kick details must be a valid list.", 422, "SHOOTOUT_KICKS_INVALID");
  }

  let homeSuccessfulKicks = 0;
  let awaySuccessfulKicks = 0;

  for (const [index, kick] of shootout.kicks.entries()) {
    const kickingTeamId = referenceId(kick?.seasonTeamRef);
    if (kickingTeamId !== homeId && kickingTeamId !== awayId) {
      throw new AppError(
        "Penalty kick " + (index + 1) + " must belong to one of the teams participating in this match.",
        422,
        "INVALID_SHOOTOUT_TEAM",
      );
    }

    if (!["scored", "missed", "saved"].includes(kick.result)) {
      throw new AppError("Penalty kick " + (index + 1) + " has an invalid result.", 422, "INVALID_SHOOTOUT_KICK");
    }

    if (kick.result === "scored") {
      if (kickingTeamId === homeId) homeSuccessfulKicks += 1;
      else awaySuccessfulKicks += 1;
    }
  }

  if (
    shootout.kicks.length > 0
    && (homeSuccessfulKicks !== shootout.homeTeamScore || awaySuccessfulKicks !== shootout.awayTeamScore)
  ) {
    throw new AppError(
      "Penalty shootout scores must match the number of recorded successful kicks for each team.",
      422,
      "SHOOTOUT_SCORE_MISMATCH",
      { penaltyShootout: "Recheck the shootout scores against the successful kicks." },
    );
  }

  if (shootout.status === "completed" && shootout.homeTeamScore === shootout.awayTeamScore) {
    throw new AppError(
      "A completed penalty shootout must produce a winner; the shootout scores cannot be tied.",
      422,
      "SHOOTOUT_TIED",
      { penaltyShootout: "Record a shootout score with one team ahead." },
    );
  }
}

/**
 * Validates a completed match result and calculates its winner.
 * Normal-time scores come only from recorded goal events; shootout scores
 * remain separate and never affect the normal-time score.
 */
export function calculateCompletedMatchWinner(
  match: MatchCompletionInput,
  matchRules: Pick<SeasonMatchRules, "groupStageDrawAllowed" | "knockoutDrawRequiresShootout">,
  pointsRules: SeasonPointsRules | null,
): string | null {
  if (match.status !== "completed") return null;

  const score = deriveMatchScore(match);
  const homeId = String(match.homeSeasonTeamRef);
  const awayId = String(match.awaySeasonTeamRef);

  if (match.stage === "group") {
    if (!pointsRules
      || ![pointsRules.win, pointsRules.draw, pointsRules.loss].every(
        (points) => Number.isFinite(points) && points >= 0,
      )) {
      throw new AppError(
        "Group-stage matches cannot be completed until valid win, draw and loss points are configured for the season.",
        409,
        "SEASON_POINTS_RULES_UNAVAILABLE",
      );
    }

    if (match.penaltyShootout) {
      throw new AppError("Group-stage matches cannot have penalty shootouts.", 422, "GROUP_SHOOTOUT");
    }

    if (score.homeScore === score.awayScore) {
      if (!matchRules.groupStageDrawAllowed) {
        throw new AppError(
          "This season does not allow group-stage draws. Record a valid winning score before completing the match.",
          422,
          "GROUP_DRAW_NOT_ALLOWED",
          { status: "A group-stage match must have a winner under this season's rules." },
        );
      }
      return null;
    }

    return score.homeScore > score.awayScore ? homeId : awayId;
  }

  if (score.homeScore === score.awayScore) {
    if (!matchRules.knockoutDrawRequiresShootout) return null;

    const shootout = match.penaltyShootout;
    if (!shootout || shootout.status !== "completed") {
      throw new AppError(
        "This knockout match is tied. Record and complete a penalty shootout before completing the match.",
        422,
        "SHOOTOUT_REQUIRED",
        { penaltyShootout: "A completed penalty shootout is required to determine the winner." },
      );
    }

    assertPenaltyShootoutScore(match, shootout);
    return shootout.homeTeamScore > shootout.awayTeamScore ? homeId : awayId;
  }

  if (match.penaltyShootout) {
    throw new AppError(
      "A penalty shootout is only valid when the normal-time match score is tied.",
      422,
      "UNNECESSARY_SHOOTOUT",
      { penaltyShootout: "Remove the shootout or correct the normal-time score." },
    );
  }

  return score.homeScore > score.awayScore ? homeId : awayId;
}
