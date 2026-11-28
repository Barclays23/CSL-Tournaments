import { getFixtureGroupReadinessBlockers } from "./seasonMatch.readiness.js";
import { Types } from "mongoose";
import { getPairFixtureError, resolveFixtureDecidingRulesForStage } from "./seasonMatch.fixtureRules.js";
import { hasRecordedMatchIncidents } from "./seasonMatch.deletion.js";
import {
  assertStageMatchesResolved,
  groupStageQualifiers,
  qualifiedTeamsForStage,
} from "./seasonMatch.qualification.js";
import {
  isKickoffWithinSeasonDateWindow,
} from "../seasons/season.rules.js";
import {
  assertPenaltyShootoutScore,
  calculateCompletedMatchWinner,
} from "./seasonMatch.completionRules.js";
import { assertMatchStatusTransition } from "./seasonMatch.statusRules.js";
import { getTimedPeriodForPhase, MATCH_TIMED_PERIODS, MATCH_PERIOD_CLOCK_KEYS, resolveMatchEventTiming, stopTimedPeriodClock, startTimedPeriodClock, eventElapsedSeconds, type MatchPhaseAction, type MatchEventTimingInput } from "./seasonMatch.engine.js";
import { assertPhaseTransitionAllowed, getRegularFullTimeOutcome, getExtraTimeOutcome } from "./seasonMatch.phaseRules.js";
import { AppError } from "../../shared/errors/appError.js";
import type { PaginatedResult } from "../../shared/types/common.types.js";
import type { SeasonMatchRepository } from "./seasonMatch.repository.js";
import type { ISeasonMatchService } from "./seasonMatch.interfaces.js";
import type {
  CreateSeasonMatchDto,
  UpdateSeasonMatchDto,
  SeasonMatchQueryDto,
  SeasonGoalDto,
  SeasonMatchCardDto,
  SeasonMatchCardResponseDto,
  SeasonMatchResponseDto,
  SeasonGoalResponseDto,
  SeasonMatchTeamDto,
  SeasonMatchPlayerDto,
  MatchAuditSnapshotDto,
} from "./seasonMatch.dto.js";
import type {
  SeasonMatchFields,
  SeasonMatchEntity,
  PopulatedSeasonMatch,
  PopulatedSeasonGoal,
  PopulatedSeasonMatchCard,
  SeasonMatchCardFields,
  MatchAuditHistoryEntry,
  MatchAuditAction,
  MatchAuditSnapshot,
  MatchEventAuditHistoryEntry,
  MatchEventAuditValue,
  SeasonGoalFields,
  MatchClock,
} from "./seasonMatch.types.js";

export class SeasonMatchService implements ISeasonMatchService {
  constructor(private readonly _seasonMatchRepo: SeasonMatchRepository) {}
  async list(
    seasonId: string,
    query: SeasonMatchQueryDto,
  ): Promise<PaginatedResult<SeasonMatchResponseDto>> {
    this.id(seasonId, "season");
    const filter: import("./seasonMatch.types.js").SeasonMatchListFilter = {
      seasonRef: new Types.ObjectId(seasonId),
    };
    if (query.stage) filter.stage = query.stage;
    if (query.groupRef !== undefined)
      filter.groupRef = query.groupRef
        ? new Types.ObjectId(query.groupRef)
        : null;
    if (query.status) filter.status = query.status;
    if (query.dateFrom || query.dateTo)
      filter.kickoffAt = {
        ...(query.dateFrom ? { $gte: query.dateFrom } : {}),
        ...(query.dateTo ? { $lte: query.dateTo } : {}),
      };

    const clauses: Array<{
      $or: Array<
        Partial<import("./seasonMatch.types.js").SeasonMatchListFilter>
      >;
    }> = [];
    if (query.seasonTeamRef) {
      const teamId = new Types.ObjectId(query.seasonTeamRef);
      clauses.push({
        $or: [{ homeSeasonTeamRef: teamId }, { awaySeasonTeamRef: teamId }],
      });
    }
    if (query.search) {
      const search = query.search.trim();
      const conditions: Array<
        Partial<import("./seasonMatch.types.js").SeasonMatchListFilter>
      > = [];
      const numberMatch = search.match(/\d+/)?.[0];
      if (numberMatch) conditions.push({ matchNumber: Number(numberMatch) });
      const matchingTeams = await this._seasonMatchRepo.findSeasonTeamIdsByName(
        seasonId,
        search,
      );
      if (matchingTeams.length)
        conditions.push(
          { homeSeasonTeamRef: { $in: matchingTeams } },
          { awaySeasonTeamRef: { $in: matchingTeams } },
        );
      if (!conditions.length)
        return {
          items: [],
          pagination: {
            page: query.page,
            limit: query.limit,
            total: 0,
            totalPages: 0,
          },
        };
      clauses.push({ $or: conditions });
    }
    if (clauses.length === 1) filter.$or = clauses[0].$or;
    else if (clauses.length > 1) filter.$and = clauses;

    const result = await this._seasonMatchRepo.find(filter, query.page, query.limit);
    return {
      items: result.items.map((m) => this.map(m)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }
  async get(id: string): Promise<SeasonMatchResponseDto> {
    this.id(id, "match");
    const m = await this._seasonMatchRepo.findPopulatedById(id);
    if (!m) throw new AppError("Match not found", 404, "MATCH_NOT_FOUND");
    return this.map(m);
  }
  private requireActor(actor?: string): Types.ObjectId {
    if (!actor || !Types.ObjectId.isValid(actor)) {
      throw new AppError("An authenticated administrator is required for this Match operation.", 401, "UNAUTHENTICATED");
    }
    return new Types.ObjectId(actor);
  }

  private auditSnapshot(match: SeasonMatchEntity): MatchAuditSnapshot {
    return {
      status: match.status,
      phase: match.phase,
      actualStartedAt: match.actualStartedAt,
      clock: {
        isRunning: match.clock.isRunning,
        clockStartedAt: match.clock.clockStartedAt,
        periodElapsedSecondsByPeriod: { ...match.clock.periodElapsedSecondsByPeriod },
      },
      decidingRules: {
        extraTime: { ...match.decidingRules.extraTime },
        penaltyShootout: { ...match.decidingRules.penaltyShootout },
      },
      kickoffAt: match.kickoffAt,
      winnerSeasonTeamRef: match.winnerSeasonTeamRef,
      penaltyShootout: match.penaltyShootout ? {
        ...match.penaltyShootout,
        kicks: match.penaltyShootout.kicks.map(kick => ({ ...kick })),
      } : null,
      score: this.score(match),
    };
  }

  private async persistOperation(
    match: SeasonMatchEntity,
    set: Partial<SeasonMatchFields>,
    action: MatchAuditAction,
    actor: string | undefined,
    reason: string | null = null,
    serializeSeasonStart = false,
    requireAuctionCompleted = false,
  ): Promise<SeasonMatchResponseDto> {
    const actorRef = this.requireActor(actor);
    const timestamp = new Date();
    const previousValue = this.auditSnapshot(match);
    const nextValue = this.auditSnapshot({ ...match, ...set });
    const entry: MatchAuditHistoryEntry = {
      action,
      actor: actorRef,
      timestamp,
      previousValue,
      newValue: nextValue,
      reason,
    };
    const saved = await this._seasonMatchRepo.applyOperationalUpdate(
      String(match._id),
      match.updatedAt,
      set,
      entry,
      { serializeSeasonStart, requireAuctionCompleted },
    );
    if (!saved) throw new AppError("Match not found", 404, "MATCH_NOT_FOUND");
    const populated = await this._seasonMatchRepo.findPopulatedById(String(match._id));
    if (!populated) throw new AppError("Updated Match could not be retrieved.", 500, "MATCH_UPDATE_FAILED");
    return this.map(populated);
  }

  private async requireWritableSeason(match: SeasonMatchEntity): Promise<void> {
    const season = await this._seasonMatchRepo.findSeason(String(match.seasonRef));
    if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (season.status !== "active") {
      throw new AppError("Completed or Archived Seasons are read-only.", 409, "SEASON_WRITE_LOCKED");
    }
  }

  private async requireMatchAndActiveSeason(id: string): Promise<SeasonMatchEntity> {
    const match = await this.getExisting(id);
    if (match.status === "completed" || match.status === "cancelled" || match.status === "abandoned") {
      throw new AppError("This Match is terminal. Use the audited correction workflow where permitted.", 409, "MATCH_TERMINAL");
    }
    await this.requireWritableSeason(match);
    return match;
  }

  async startMatch(id: string, actor?: string): Promise<SeasonMatchResponseDto> {
    const match = await this.getExisting(id);
    if (match.status !== "scheduled" || match.actualStartedAt || match.phase !== null) {
      throw new AppError("Only a not-yet-started Scheduled Match can be started. Duplicate kickoff actions are rejected.", 409, "MATCH_START_NOT_ALLOWED");
    }
    if (match.clock.isRunning || match.clock.clockStartedAt) {
      throw new AppError("A scheduled Match cannot already have a running clock segment.", 409, "MATCH_CLOCK_INVALID");
    }
    const season = await this._seasonMatchRepo.findSeason(String(match.seasonRef));
    if (!season || season.status !== "active") {
      throw new AppError("A Match can only start while its Season is Active.", 409, "SEASON_NOT_ACTIVE");
    }
    if (!match.decidingRules || (match.stage === "group" && (match.decidingRules.extraTime.isAllowed || match.decidingRules.penaltyShootout.isAllowed))) {
      throw new AppError("The saved deciding rules are invalid for this fixture.", 409, "MATCH_DECIDING_RULES_INVALID");
    }
    const now = new Date();
    const clock = startTimedPeriodClock(match.clock, "first_half", now);
    return this.persistOperation(match, {
      status: "live",
      actualStartedAt: now,
      phase: "first_half",
      clock,
      winnerSeasonTeamRef: null,
    }, "start_match", actor, null, true);
  }

  async pauseClock(id: string, actor?: string): Promise<SeasonMatchResponseDto> {
    const match = await this.requireMatchAndActiveSeason(id);
    if (match.status !== "live") throw new AppError("Only a Live Match clock can be paused.", 409, "MATCH_NOT_LIVE");
    if (!match.clock.isRunning) throw new AppError("The Match clock is already paused.", 409, "MATCH_CLOCK_NOT_RUNNING");
    const clock = stopTimedPeriodClock(match, new Date());
    return this.persistOperation(match, { clock }, "pause_clock", actor);
  }

  async resumeClock(id: string, actor?: string): Promise<SeasonMatchResponseDto> {
    const match = await this.requireMatchAndActiveSeason(id);
    if (match.status !== "live") throw new AppError("Only a Live Match clock can be resumed.", 409, "MATCH_NOT_LIVE");
    if (match.clock.isRunning) throw new AppError("The Match clock is already running.", 409, "MATCH_CLOCK_ALREADY_RUNNING");
    const clock = startTimedPeriodClock(match.clock, match.phase, new Date());
    return this.persistOperation(match, { clock }, "resume_clock", actor);
  }

  async transitionPhase(id: string, action: MatchPhaseAction, actor?: string): Promise<SeasonMatchResponseDto> {
    const match = await this.requireMatchAndActiveSeason(id);
    const season = await this._seasonMatchRepo.findSeason(String(match.seasonRef));
    if (!season || !season.matchRules) throw new AppError("Season match rules are unavailable.", 409, "SEASON_RULES_UNAVAILABLE");
    const score = this.score(match);
    assertPhaseTransitionAllowed(match, action, score.homeScore, score.awayScore);

    const now = new Date();
    let phase: SeasonMatchFields["phase"] = match.phase;
    let clock = match.clock;
    let penaltyShootout = match.penaltyShootout;

    switch (action) {
      case "half_time":
        clock = stopTimedPeriodClock(match, now);
        phase = "half_time";
        break;
      case "start_second_half":
        phase = "second_half";
        clock = startTimedPeriodClock(clock, phase, now);
        break;
      case "regular_full_time":
        clock = stopTimedPeriodClock(match, now);
        phase = "regular_full_time";
        break;
      case "start_extra_time":
        phase = "extra_time_first_half";
        clock = startTimedPeriodClock(clock, phase, now);
        break;
      case "extra_time_half_time":
        clock = stopTimedPeriodClock(match, now);
        phase = "extra_time_half_time";
        break;
      case "start_extra_time_second_half":
        phase = "extra_time_second_half";
        clock = startTimedPeriodClock(clock, phase, now);
        break;
      case "end_extra_time":
        clock = stopTimedPeriodClock(match, now);
        phase = "extra_time_completed";
        break;
      case "start_penalty_shootout":
        if (match.clock.isRunning || match.clock.clockStartedAt) throw new AppError("Stop the timed Match clock before starting a Penalty Shootout.", 409, "MATCH_CLOCK_MUST_BE_STOPPED");
        phase = "penalty_shootout";
        penaltyShootout = {
          status: "pending",
          homeTeamScore: 0,
          awayTeamScore: 0,
          kicks: [],
        };
        clock = { ...clock, isRunning: false, clockStartedAt: null };
        break;
      case "complete_penalty_shootout": {
        if (!penaltyShootout) throw new AppError("Record the shootout before completing it.", 409, "SHOOTOUT_REQUIRED");
        const completedShootout = { ...penaltyShootout, status: "completed" as const };
        assertPenaltyShootoutScore(match, completedShootout);
        if (completedShootout.homeTeamScore === completedShootout.awayTeamScore) {
          throw new AppError("A completed shootout must have a winner.", 422, "SHOOTOUT_TIED");
        }
        penaltyShootout = completedShootout;
        phase = "penalty_shootout_completed";
        clock = { ...clock, isRunning: false, clockStartedAt: null };
        break;
      }
    }
    return this.persistOperation(match, { phase, clock, penaltyShootout }, "phase_transition", actor);
  }

  async completeMatch(id: string, actor?: string): Promise<SeasonMatchResponseDto> {
    const match = await this.requireMatchAndActiveSeason(id);
    if (match.status !== "live" || match.clock.isRunning || match.clock.clockStartedAt) {
      throw new AppError("A Match can be completed only while Live with the clock stopped.", 409, "MATCH_CLOCK_MUST_BE_STOPPED");
    }
    if (!match.actualStartedAt) throw new AppError("A Match cannot be completed before its actual kickoff.", 409, "MATCH_NOT_STARTED");
    if (!["regular_full_time", "extra_time_completed", "penalty_shootout_completed"].includes(match.phase ?? "")) {
      throw new AppError("Complete all required timed periods and deciding stages before completing the Match.", 409, "MATCH_PHASE_INCOMPLETE");
    }
    const season = await this._seasonMatchRepo.findSeason(String(match.seasonRef));
    if (!season?.matchRules) throw new AppError("Season match rules are unavailable.", 409, "SEASON_RULES_UNAVAILABLE");
    const score = this.score(match);
    if (match.stage === "group") {
      if (match.decidingRules.extraTime.isAllowed || match.decidingRules.penaltyShootout.isAllowed || match.phase !== "regular_full_time") {
        throw new AppError("A group-stage Match must finish after Regular Full Time without extra deciding stages.", 409, "GROUP_DECIDING_RULES");
      }
    } else if (match.phase === "regular_full_time") {
      const outcome = getRegularFullTimeOutcome(match.stage, match.decidingRules, score.homeScore, score.awayScore);
      if (outcome !== "complete") {
        throw new AppError("This Match still requires its configured deciding stage.", 409, outcome === "extra_time" ? "EXTRA_TIME_REQUIRED" : "SHOOTOUT_REQUIRED");
      }
    } else if (match.phase === "extra_time_completed") {
      const outcome = getExtraTimeOutcome(match.decidingRules, score.homeScore, score.awayScore);
      if (outcome !== "complete") throw new AppError("A tied Match after Extra Time requires the configured Penalty Shootout.", 409, "SHOOTOUT_REQUIRED");
    } else if (match.phase === "penalty_shootout_completed") {
      if (!match.penaltyShootout || match.penaltyShootout.status !== "completed") {
        throw new AppError("The Penalty Shootout has not been completed.", 409, "SHOOTOUT_REQUIRED");
      }
    }
    const resultMatch: SeasonMatchFields = { ...match, status: "completed", phase: "full_time" };
    const winner = match.stage === "group" && score.homeScore === score.awayScore
      ? null
      : this.calculateWinner(resultMatch, season.matchRules, season.pointsRules);
    resultMatch.winnerSeasonTeamRef = winner;
    return this.persistOperation(match, {
      status: "completed",
      phase: "full_time",
      clock: { ...match.clock, isRunning: false, clockStartedAt: null },
      winnerSeasonTeamRef: winner,
    }, "status_change", actor, "Match completed after all required stages were resolved.");
  }

  async updateDecidingRules(id: string, input: import("./seasonMatch.dto.js").UpdateMatchDecidingRulesDto, actor?: string): Promise<SeasonMatchResponseDto> {
    const match = await this.requireMatchAndActiveSeason(id);
    if (match.status === "completed" || match.phase === "full_time") throw new AppError("Completed Match deciding rules are read-only.", 409, "MATCH_DECIDING_RULES_LOCKED");
    const requested = input.decidingRules;
    if (match.stage === "group" && (requested.extraTime.isAllowed || requested.penaltyShootout.isAllowed)) {
      throw new AppError("Group-stage fixtures must always have Extra Time and Penalty Shootout disabled.", 422, "GROUP_DECIDING_RULES");
    }
    const extraTimeStarted = ["extra_time_first_half", "extra_time_half_time", "extra_time_second_half", "extra_time_completed", "penalty_shootout", "penalty_shootout_completed", "full_time"].includes(match.phase ?? "")
      || match.clock.periodElapsedSecondsByPeriod.extraTimeFirstHalf > 0
      || match.clock.periodElapsedSecondsByPeriod.extraTimeSecondHalf > 0
      || (match.auditHistory ?? []).some(entry =>
        ["phase_transition", "phase_correction"].includes(entry.action)
        && ["extra_time_first_half", "extra_time_half_time", "extra_time_second_half", "extra_time_completed"].includes(entry.newValue.phase ?? ""),
      );
    const shootoutStarted = ["penalty_shootout", "penalty_shootout_completed", "full_time"].includes(match.phase ?? "")
      || Boolean(match.penaltyShootout)
      || (match.auditHistory ?? []).some(entry =>
        ["phase_transition", "phase_correction"].includes(entry.action)
        && ["penalty_shootout", "penalty_shootout_completed"].includes(entry.newValue.phase ?? ""),
      );
    if (extraTimeStarted && (
      requested.extraTime.isAllowed !== match.decidingRules.extraTime.isAllowed
      || requested.extraTime.durationMinutes !== match.decidingRules.extraTime.durationMinutes
    )) throw new AppError("Extra Time rules are locked once Extra Time starts.", 409, "EXTRA_TIME_RULES_LOCKED");
    if (shootoutStarted) throw new AppError("All deciding rules are locked once a Penalty Shootout starts.", 409, "MATCH_DECIDING_RULES_LOCKED");
    if (!Number.isSafeInteger(requested.extraTime.durationMinutes) || requested.extraTime.durationMinutes <= 0 || requested.extraTime.durationMinutes % 2 !== 0) {
      throw new AppError("Extra Time duration must be a positive even number of minutes.", 422, "INVALID_EXTRA_TIME_DURATION");
    }
    if (match.actualStartedAt && !input.reason?.trim()) throw new AppError("A reason is required when deciding rules are changed after kickoff.", 422, "MATCH_AUDIT_REASON_REQUIRED");
    return this.persistOperation(match, { decidingRules: requested }, "deciding_rules_change", actor, input.reason?.trim() ?? null);
  }

  async changeStatus(id: string, input: import("./seasonMatch.dto.js").MatchStatusActionDto, actor?: string): Promise<SeasonMatchResponseDto> {
    const match = await this.requireMatchAndActiveSeason(id);
    const reason = input.action === "resume" ? null : input.reason.trim();
    if (input.action !== "resume" && (reason!.length < 3 || reason!.length > 500)) {
      throw new AppError("Enter a reason between 3 and 500 characters.", 422, "MATCH_STATUS_REASON_REQUIRED");
    }
    if (input.action === "resume") {
      assertMatchStatusTransition(match.status, "live");
      if (match.status !== "postponed" || !match.actualStartedAt) {
        throw new AppError("Only a Postponed Match that has already kicked off can resume as the same fixture.", 409, "MATCH_RESUME_NOT_ALLOWED");
      }
      let clock = match.clock;
      if (getTimedPeriodForPhase(match.phase)) clock = startTimedPeriodClock(clock, match.phase, new Date());
      return this.persistOperation(match, { status: "live", clock }, "status_change", actor, "Resumed the postponed Match at its preserved phase and clock position.", true);
    }

    if (input.action === "postpone") {
      assertMatchStatusTransition(match.status, "postponed");
      if (match.status !== "scheduled" && match.status !== "live") throw new AppError("Only Scheduled or Live matches can be postponed.", 409, "MATCH_POSTPONE_NOT_ALLOWED");
      if (match.status === "live" && (match.clock.isRunning || match.clock.clockStartedAt)) throw new AppError("Pause the Match clock before postponing a Live Match.", 409, "MATCH_CLOCK_MUST_BE_STOPPED");
      return this.persistOperation(match, { status: "postponed" }, "status_change", actor, reason);
    }

    if (input.action === "cancel") {
      assertMatchStatusTransition(match.status, "cancelled");
      if (match.actualStartedAt || (match.status !== "scheduled" && match.status !== "postponed")) throw new AppError("A Match can only be cancelled before its first kickoff.", 409, "MATCH_CANCEL_NOT_ALLOWED");
      const resolutionHistory = [...(match.resolutionHistory ?? []), { status: "cancelled" as const, reason: reason!, decidedAt: new Date() }];
      return this.persistOperation(match, { status: "cancelled", resolutionHistory }, "status_change", actor, reason);
    }

    if (input.action === "abandon") {
      assertMatchStatusTransition(match.status, "abandoned");
      if ((match.status !== "live" && match.status !== "postponed") || !match.actualStartedAt) throw new AppError("A started Match may be abandoned only while Live or Postponed.", 409, "MATCH_ABANDON_NOT_ALLOWED");
      const clock = match.clock.isRunning ? stopTimedPeriodClock(match, new Date()) : { ...match.clock, isRunning: false, clockStartedAt: null };
      const resolutionHistory = [...(match.resolutionHistory ?? []), { status: "abandoned" as const, reason: reason!, decidedAt: new Date() }];
      return this.persistOperation(match, { status: "abandoned", clock, resolutionHistory }, "status_change", actor, reason);
    }
    throw new AppError("Unsupported Match status action.", 422, "INVALID_MATCH_STATUS_ACTION");
  }

  async correctActualKickoff(id: string, input: import("./seasonMatch.dto.js").CorrectActualKickoffDto, actor?: string): Promise<SeasonMatchResponseDto> {
    const match = await this.getExisting(id);
    await this.requireWritableSeason(match);
    if (!match.actualStartedAt || !input.actualStartedAt || Number.isNaN(input.actualStartedAt.getTime())) {
      throw new AppError("Only an existing actual kickoff can be corrected to a valid timestamp.", 409, "ACTUAL_KICKOFF_CORRECTION_NOT_ALLOWED");
    }
    const reason = input.reason.trim();
    if (reason.length < 3 || reason.length > 1000 || input.actualStartedAt.getTime() > Date.now()) throw new AppError("Enter a valid past actual kickoff and a correction reason.", 422, "MATCH_AUDIT_REASON_REQUIRED");
    return this.persistOperation(match, { actualStartedAt: input.actualStartedAt }, "actual_kickoff_correction", actor, reason);
  }

  async correctClock(id: string, input: import("./seasonMatch.dto.js").CorrectMatchClockDto, actor?: string): Promise<SeasonMatchResponseDto> {
    const match = await this.getExisting(id);
    await this.requireWritableSeason(match);
    if (!match.actualStartedAt || match.clock.isRunning || match.clock.clockStartedAt) {
      throw new AppError("Pause the clock before correcting elapsed Match time.", 409, "MATCH_CLOCK_MUST_BE_STOPPED");
    }
    const nextElapsed = { ...match.clock.periodElapsedSecondsByPeriod, ...input.periodElapsedSecondsByPeriod };
    for (const goal of match.goals) {
      const elapsed = eventElapsedSeconds(match, goal);
      if (elapsed !== null && elapsed > nextElapsed[MATCH_PERIOD_CLOCK_KEYS[goal.period!]]) {
        throw new AppError("Clock correction would place an existing goal after the corrected clock. Correct the event explicitly first.", 409, "MATCH_CLOCK_BEFORE_EXISTING_EVENT");
      }
    }
    for (const card of match.cards ?? []) {
      const elapsed = eventElapsedSeconds(match, card);
      if (elapsed !== null && elapsed > nextElapsed[MATCH_PERIOD_CLOCK_KEYS[card.period!]]) {
        throw new AppError("Clock correction would place an existing card after the corrected clock. Correct the event explicitly first.", 409, "MATCH_CLOCK_BEFORE_EXISTING_EVENT");
      }
    }
    const reason = input.reason.trim();
    if (reason.length < 3 || reason.length > 1000) throw new AppError("A clock correction reason is required.", 422, "MATCH_AUDIT_REASON_REQUIRED");
    const clock: MatchClock = { ...match.clock, isRunning: false, clockStartedAt: null, periodElapsedSecondsByPeriod: nextElapsed };
    return this.persistOperation(match, { clock }, "clock_correction", actor, reason);
  }

  async correctPhase(id: string, input: import("./seasonMatch.dto.js").CorrectMatchPhaseDto, actor?: string): Promise<SeasonMatchResponseDto> {
    const match = await this.requireMatchAndActiveSeason(id);
    if (match.status !== "live" || !match.actualStartedAt || match.clock.isRunning || match.clock.clockStartedAt) {
      throw new AppError("Phase corrections require a started Live Match with its clock stopped.", 409, "MATCH_PHASE_CORRECTION_NOT_ALLOWED");
    }
    const phase = input.phase;
    const indexByPhase: Record<Exclude<SeasonMatchFields["phase"], null | "full_time">, number> = {
      first_half: 0, half_time: 0, second_half: 1, regular_full_time: 1,
      extra_time_first_half: 2, extra_time_half_time: 2,
      extra_time_second_half: 3, extra_time_completed: 3,
      penalty_shootout: match.clock.periodElapsedSecondsByPeriod.extraTimeFirstHalf > 0 || match.clock.periodElapsedSecondsByPeriod.extraTimeSecondHalf > 0 ? 3 : 1,
      penalty_shootout_completed: match.clock.periodElapsedSecondsByPeriod.extraTimeFirstHalf > 0 || match.clock.periodElapsedSecondsByPeriod.extraTimeSecondHalf > 0 ? 3 : 1,
    };
    const targetIndex = indexByPhase[phase];
    const elapsed = Object.values(match.clock.periodElapsedSecondsByPeriod);
    if (elapsed.some((seconds, index) => index > targetIndex && seconds > 0)) {
      throw new AppError("The corrected phase cannot precede already recorded elapsed time in a later period.", 409, "MATCH_PHASE_BEFORE_CLOCK");
    }
    for (const event of [...match.goals, ...(match.cards ?? [])]) {
      if (event.period && MATCH_TIMED_PERIODS.indexOf(event.period) > targetIndex) {
        throw new AppError("The corrected phase cannot precede existing Match events. Correct those events first.", 409, "MATCH_PHASE_BEFORE_EVENT");
      }
    }
    if (phase.startsWith("extra_time_")) {
      if (match.stage === "group" || !match.decidingRules.extraTime.isAllowed) throw new AppError("Extra Time is not enabled for this fixture.", 409, "EXTRA_TIME_DISABLED");
    }
    if (phase.startsWith("penalty_shootout")) {
      const score = this.score(match);
      if (match.stage === "group" || !match.decidingRules.penaltyShootout.isAllowed || score.homeScore !== score.awayScore) {
        throw new AppError("Penalty Shootout is not valid for this fixture state.", 409, "SHOOTOUT_NOT_ALLOWED");
      }
      if (match.decidingRules.extraTime.isAllowed && phase === "penalty_shootout" && match.phase !== "extra_time_completed" && match.phase !== "penalty_shootout" && match.phase !== "penalty_shootout_completed") {
        throw new AppError("Complete the configured Extra Time before correcting the phase to Penalty Shootout.", 409, "EXTRA_TIME_REQUIRED");
      }
      if (phase === "penalty_shootout_completed" && match.penaltyShootout?.status !== "completed") {
        throw new AppError("A completed shootout record is required for this phase.", 409, "SHOOTOUT_REQUIRED");
      }
    }
    const reason = input.reason.trim();
    if (reason.length < 3 || reason.length > 1000) throw new AppError("A phase correction reason is required.", 422, "MATCH_AUDIT_REASON_REQUIRED");
    return this.persistOperation(match, { phase, clock: { ...match.clock, isRunning: false, clockStartedAt: null } }, "phase_correction", actor, reason);
  }

  async updateShootout(id: string, input: import("./seasonMatch.dto.js").UpdateMatchShootoutDto, actor?: string): Promise<SeasonMatchResponseDto> {
    const match = await this.requireMatchAndActiveSeason(id);
    if (match.status !== "live" || match.phase !== "penalty_shootout" || match.stage === "group" || !match.decidingRules.penaltyShootout.isAllowed) {
      throw new AppError("Shootout kicks can only be recorded during an enabled knockout Penalty Shootout.", 409, "SHOOTOUT_MANAGEMENT_NOT_ALLOWED");
    }
    const shootout = {
      status: "pending" as const,
      homeTeamScore: input.homeTeamScore,
      awayTeamScore: input.awayTeamScore,
      kicks: input.kicks.map(kick => ({
        seasonTeamRef: new Types.ObjectId(kick.seasonTeamRef),
        playerRef: kick.playerRef ? new Types.ObjectId(kick.playerRef) : null,
        result: kick.result,
      })),
    };
    await this.validateShootout(String(match.seasonRef), match, shootout);
    return this.persistOperation(match, { penaltyShootout: shootout }, "shootout_update", actor);
  }

  private score(match: Pick<SeasonMatchFields, "homeSeasonTeamRef" | "awaySeasonTeamRef" | "goals">): { homeScore: number; awayScore: number } {
    let homeScore = 0;
    let awayScore = 0;
    const home = String(match.homeSeasonTeamRef);
    const away = String(match.awaySeasonTeamRef);
    for (const goal of match.goals ?? []) {
      if (String(goal.scoringSeasonTeamRef) === home) homeScore += 1;
      else if (String(goal.scoringSeasonTeamRef) === away) awayScore += 1;
    }
    return { homeScore, awayScore };
  }

  async create(
    seasonId: string,
    input: CreateSeasonMatchDto,
  ): Promise<SeasonMatchResponseDto> {
    this.id(seasonId, "season");
    const season = await this._seasonMatchRepo.findSeason(seasonId);
    if (!season || season.status !== "active")
      throw new AppError(
        "Fixtures can only be created after the season has been activated",
        409,
        "SEASON_NOT_FIXTURE_READY",
      );
    if (season.auctionLifecycleStatus !== "completed")
      throw new AppError(
        "Complete the auction and validate every team roster before creating fixtures.",
        409,
        "AUCTION_NOT_COMPLETED",
      );
    if (season.groupStageEnabled !== false) {
      const readiness = await this._seasonMatchRepo.getGroupReadiness(seasonId);
      const blockers = getFixtureGroupReadinessBlockers(true, readiness);
      if (blockers.length)
        throw new AppError(
          "Assign every participating team to a valid group before creating fixtures.",
          409,
          "SEASON_GROUPS_INCOMPLETE",
          {
            groups: blockers.join("; "),
          },
        );
    }
    if (!season.matchRules)
      throw new AppError(
        "Match rules are unavailable for this historical season",
        409,
        "SEASON_RULES_UNAVAILABLE",
      );
    if (input.stage === "group" && season.groupStageEnabled === false)
      throw new AppError(
        "Group-stage fixtures are disabled for this season",
        409,
        "GROUP_STAGE_DISABLED",
      );
    this.assertKickoffWithinSeason(season, input.kickoffAt);
    if (await this._seasonMatchRepo.findByNumber(seasonId, input.matchNumber))
      throw new AppError(
        "Match number already exists in this season",
        409,
        "DUPLICATE_MATCH_NUMBER",
      );
    const homeId = input.homeSeasonTeamRef,
      awayId = input.awaySeasonTeamRef;
    await this.validateSeasonTeams(
      seasonId,
      homeId,
      awayId,
      input.stage,
      input.groupRef ?? null,
    );
    await this.validateFixturePair(
      seasonId,
      input.stage,
      input.groupRef ?? null,
      input.roundNumber,
      homeId,
      awayId,
      season.homeAndAwayFixtures ?? false,
    );
    const venue = await this._seasonMatchRepo.findVenue(input.venueRef);
    if (!venue || venue.status !== "active")
      throw new AppError(
        "Choose an active venue from the venue list",
        422,
        "INVALID_VENUE",
        { venueRef: "Choose an active venue" },
      );
    await this.validateKnockoutQualification(
      seasonId,
      input.stage,
      homeId,
      awayId,
      season,
    );
    const matchDurationMinutes=input.matchDurationMinutes??season.matchRules.defaultMatchDurationMinutes;
    const decidingRules=input.stage==="group"?{
      extraTime:{isAllowed:false,durationMinutes:season.matchRules.extraTime.defaultDurationMinutes},
      penaltyShootout:{isAllowed:false},
    }:{
      extraTime:{isAllowed:input.decidingRules?.extraTime.isAllowed??season.matchRules.extraTime.isAllowedByDefault,durationMinutes:input.decidingRules?.extraTime.durationMinutes??season.matchRules.extraTime.defaultDurationMinutes},
      penaltyShootout:{isAllowed:input.decidingRules?.penaltyShootout.isAllowed??season.matchRules.penaltyShootout.isAllowedByDefault},
    };
    if(input.stage==="group"&&(decidingRules.extraTime.isAllowed||decidingRules.penaltyShootout.isAllowed))throw new AppError("Group-stage fixtures cannot enable Extra Time or Penalty Shootout",422,"GROUP_DECIDING_RULES");
    const fields: SeasonMatchFields = {
      seasonRef: new Types.ObjectId(seasonId),
      matchNumber: input.matchNumber,
      roundNumber: input.roundNumber,
      stage: input.stage,
      groupRef:
        input.stage === "group" && input.groupRef
          ? new Types.ObjectId(input.groupRef)
          : null,
      kickoffAt: input.kickoffAt,
      venueRef: new Types.ObjectId(input.venueRef),
      homeSeasonTeamRef: new Types.ObjectId(homeId),
      awaySeasonTeamRef: new Types.ObjectId(awayId),
      status: "scheduled",
      matchDurationMinutes,
      decidingRules,
      actualStartedAt:null,
      phase:null,
      clock:{isRunning:false,clockStartedAt:null,periodElapsedSecondsByPeriod:{firstHalf:0,secondHalf:0,extraTimeFirstHalf:0,extraTimeSecondHalf:0}},
      goals: [],
      penaltyShootout: null,
      winnerSeasonTeamRef: null,
      notes: input.notes ?? null,
      resolutionHistory: [],
    };
    const created = await this._seasonMatchRepo.create(
      fields,
      season.homeAndAwayFixtures ?? false,
    );
    const populated = await this._seasonMatchRepo.findPopulatedById(String(created._id));
    if (!populated)
      throw new AppError(
        "Created fixture could not be retrieved",
        500,
        "MATCH_CREATE_FAILED",
      );
    return this.map(populated);
  }
  async update(
    id: string,
    input: UpdateSeasonMatchDto,
    changedBy?: string,
  ): Promise<SeasonMatchResponseDto> {
    this.id(id, "match");
    const existing = await this._seasonMatchRepo.findById(id);
    if (!existing) throw new AppError("Match not found", 404, "MATCH_NOT_FOUND");
    const allowedFields = new Set(["matchNumber", "roundNumber", "stage", "groupRef", "kickoffAt", "venueRef", "homeSeasonTeamRef", "awaySeasonTeamRef", "notes", "matchDurationMinutes"]);
    const unsupportedFields = Object.keys(input).filter(field => !allowedFields.has(field));
    if (unsupportedFields.length) throw new AppError("Match status, phase, clock, deciding rules and shootout must use their dedicated Match operations.", 422, "MATCH_OPERATION_REQUIRES_DEDICATED_ENDPOINT");
    if (["completed", "cancelled", "abandoned"].includes(existing.status)) {
      throw new AppError("Completed, Cancelled and Abandoned matches are terminal. Use the audited correction workflow where permitted.", 409, "MATCH_TERMINAL");
    }
    const coreFields = ["kickoffAt", "homeSeasonTeamRef", "awaySeasonTeamRef", "stage", "groupRef", "roundNumber", "matchNumber", "venueRef", "matchDurationMinutes"] as const;
    const coreMutation = coreFields.some(field => input[field] !== undefined);
    if (existing.actualStartedAt && coreMutation) {
      throw new AppError("Fixture identity, schedule, participants, venue and regular duration are immutable after the first actual kickoff, including after postponement.", 409, "FIXTURE_LOCKED_AFTER_KICKOFF");
    }
    if (existing.status === "postponed" && Object.keys(input).length > 0) {
      throw new AppError("Postponed fixtures can only be rescheduled or cancelled before kickoff, or resumed/abandoned after kickoff.", 409, "MATCH_DETAILS_EDIT_NOT_ALLOWED");
    }
    const season = await this._seasonMatchRepo.findSeason(String(existing.seasonRef));
    if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (season.status !== "active") throw new AppError("Match management is available only while the season is Active.", 409, "SEASON_NOT_ACTIVE");
    if (existing.status !== "scheduled" && coreMutation) {
      throw new AppError("Only not-yet-started Scheduled fixtures can be edited. Use the dedicated reschedule or Match operations for other states.", 409, "MATCH_DETAILS_EDIT_NOT_ALLOWED");
    }
    if (season.auctionLifecycleStatus !== "completed") {
      throw new AppError("Complete the auction before editing fixture details or schedules.", 409, "AUCTION_NOT_COMPLETED");
    }
    if (input.matchDurationMinutes !== undefined
      && (!Number.isSafeInteger(input.matchDurationMinutes) || input.matchDurationMinutes < 10 || input.matchDurationMinutes > 120 || input.matchDurationMinutes % 2 !== 0)) {
      throw new AppError("Regular match duration must be an even whole number from 10 through 120 minutes.", 422, "INVALID_MATCH_DURATION");
    }

    const homeId = input.homeSeasonTeamRef ?? String(existing.homeSeasonTeamRef);
    const awayId = input.awaySeasonTeamRef ?? String(existing.awaySeasonTeamRef);
    const stage = input.stage ?? existing.stage;
    const groupId = input.groupRef === undefined
      ? (existing.groupRef ? String(existing.groupRef) : null)
      : input.groupRef;
    const roundNumber = input.roundNumber ?? existing.roundNumber;
    const venueRef = input.venueRef ?? String(existing.venueRef);
    const kickoffAt = input.kickoffAt ?? existing.kickoffAt;

    if (coreMutation) {
      if (!season.matchRules) throw new AppError("Match rules are unavailable for this historical season.", 409, "SEASON_RULES_UNAVAILABLE");
      await this.validateSeasonTeams(String(existing.seasonRef), homeId, awayId, stage, groupId);
      const pairChanged = homeId !== String(existing.homeSeasonTeamRef)
        || awayId !== String(existing.awaySeasonTeamRef)
        || stage !== existing.stage
        || groupId !== (existing.groupRef ? String(existing.groupRef) : null)
        || roundNumber !== existing.roundNumber;
      if (pairChanged) {
        await this.validateFixturePair(String(existing.seasonRef), stage, groupId, roundNumber, homeId, awayId, season.homeAndAwayFixtures ?? false, id);
      }
      const venue = await this._seasonMatchRepo.findVenue(venueRef);
      if (!venue || venue.status !== "active") {
        throw new AppError("Choose an active venue from the venue list.", 422, "INVALID_VENUE", { venueRef: "Choose an active venue" });
      }
      this.assertKickoffWithinSeason(season, kickoffAt);
      if (stage === "group" && season.groupStageEnabled === false) throw new AppError("Group-stage fixtures are disabled for this season.", 409, "GROUP_STAGE_DISABLED");
      await this.validateKnockoutQualification(String(existing.seasonRef), stage, homeId, awayId, season);
      if (input.matchNumber !== undefined && input.matchNumber !== existing.matchNumber) {
        const duplicate = await this._seasonMatchRepo.findByNumber(String(existing.seasonRef), input.matchNumber);
        if (duplicate && String(duplicate._id) !== id) throw new AppError("Match number already exists in this season.", 409, "DUPLICATE_MATCH_NUMBER");
      }
    }

    const data: Partial<SeasonMatchFields> = {};
    if (input.matchNumber !== undefined) data.matchNumber = input.matchNumber;
    if (input.roundNumber !== undefined) data.roundNumber = input.roundNumber;
    if (input.stage !== undefined) data.stage = input.stage;
    if (input.groupRef !== undefined) data.groupRef = stage === "group" && groupId ? new Types.ObjectId(groupId) : null;
    if (input.kickoffAt !== undefined) data.kickoffAt = input.kickoffAt;
    if (input.venueRef !== undefined) data.venueRef = new Types.ObjectId(input.venueRef);
    if (input.homeSeasonTeamRef !== undefined) data.homeSeasonTeamRef = new Types.ObjectId(input.homeSeasonTeamRef);
    if (input.awaySeasonTeamRef !== undefined) data.awaySeasonTeamRef = new Types.ObjectId(input.awaySeasonTeamRef);
    if (input.matchDurationMinutes !== undefined) data.matchDurationMinutes = input.matchDurationMinutes;
    if (stage !== existing.stage) {
      data.decidingRules = resolveFixtureDecidingRulesForStage(
        existing.stage,
        stage,
        existing.decidingRules,
        season.matchRules,
      );
    }
    if (input.notes !== undefined) data.notes = input.notes ?? null;

    const saved = await this._seasonMatchRepo.update(
      id,
      data,
      season.homeAndAwayFixtures ?? false,
      undefined,
      { requireEditableWithoutEvents: false, requireAuctionCompleted: true },
    );
    if (!saved) throw new AppError("Match changed during fixture update. Refresh and try again.", 409, "MATCH_OPERATION_CONFLICT");
    const populated = await this._seasonMatchRepo.findPopulatedById(id);
    if (!populated) throw new AppError("Updated fixture could not be retrieved.", 500, "MATCH_UPDATE_FAILED");
    return this.map(populated);
  }
  async reschedule(
    id: string,
    input: import("./seasonMatch.dto.js").RescheduleSeasonMatchDto,
    changedBy?: string,
  ): Promise<SeasonMatchResponseDto> {
    this.id(id, "match");
    const existing = await this._seasonMatchRepo.findById(id);
    if (!existing) throw new AppError("Match not found", 404, "MATCH_NOT_FOUND");
    if (existing.status !== "postponed") {
      throw new AppError("Only Postponed matches can be rescheduled", 409, "MATCH_NOT_POSTPONED");
    }
    if (existing.actualStartedAt) {
      throw new AppError("A Match that has already kicked off must resume in its preserved phase or be abandoned; it cannot be rescheduled as a new fixture.", 409, "STARTED_MATCH_RESCHEDULE_NOT_ALLOWED");
    }
    assertMatchStatusTransition(existing.status, "scheduled");
    const season = await this._seasonMatchRepo.findSeason(String(existing.seasonRef));
    if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (season.auctionLifecycleStatus !== "completed") {
      throw new AppError("Complete the auction before rescheduling this fixture.", 409, "AUCTION_NOT_COMPLETED");
    }
    if (season.status !== "active") {
      throw new AppError("Matches can only be rescheduled while the season is Active.", 409, "SEASON_NOT_ACTIVE");
    }
    if (!(input.kickoffAt instanceof Date) || Number.isNaN(input.kickoffAt.getTime())) {
      throw new AppError("A valid new match date and kick-off time are required", 422, "RESCHEDULE_KICKOFF_REQUIRED", {
        kickoffAt: "Enter a valid date and kick-off time",
      });
    }
    if (input.kickoffAt.getTime() <= Date.now()) {
      throw new AppError("Choose a future date and kick-off time when rescheduling", 422, "RESCHEDULE_KICKOFF_NOT_FUTURE", {
        kickoffAt: "The new kickoff must be in the future",
      });
    }
    if (input.kickoffAt.getTime() === existing.kickoffAt.getTime()) {
      throw new AppError("Choose a new date or kick-off time different from the postponed fixture", 422, "RESCHEDULE_KICKOFF_UNCHANGED", {
        kickoffAt: "Choose a different date or time",
      });
    }
    this.assertKickoffWithinSeason(season, input.kickoffAt);
    const reason = input.reason?.trim() ?? null;
    if (reason !== null && (reason.length < 3 || reason.length > 500)) {
      throw new AppError("Enter a rescheduling reason between 3 and 500 characters", 422, "INVALID_RESCHEDULE_REASON", {
        reason: "Reason must contain 3 to 500 characters",
      });
    }
    if (!changedBy || !Types.ObjectId.isValid(changedBy)) {
      throw new AppError("An authenticated user is required to reschedule a match", 401, "UNAUTHENTICATED");
    }
    return this.persistOperation(
      existing,
      { status: "scheduled", kickoffAt: input.kickoffAt },
      "status_change",
      changedBy,
      reason,
      false,
      true,
    );
  }

  async correctCompletedMatch(
    id: string,
    input: import("./seasonMatch.dto.js").CorrectCompletedMatchDto,
    correctedBy?: string,
  ): Promise<SeasonMatchResponseDto> {
    this.id(id, "match");
    if (!correctedBy || !Types.ObjectId.isValid(correctedBy))
      throw new AppError(
        "An authenticated administrator is required to correct a completed match",
        403,
        "FORBIDDEN",
      );
    const reason = input.reason.trim();
    if (reason.length < 3 || reason.length > 1000)
      throw new AppError(
        "Enter a correction reason between 3 and 1000 characters",
        422,
        "MATCH_CORRECTION_REASON_REQUIRED",
        { reason: "A correction reason is required" },
      );
    const existing = await this._seasonMatchRepo.findById(id);
    if (!existing)
      throw new AppError("Match not found", 404, "MATCH_NOT_FOUND");
    if (existing.status !== "completed")
      throw new AppError(
        "Only Completed matches can use the correction workflow",
        409,
        "MATCH_NOT_COMPLETED",
      );
    const season = await this._seasonMatchRepo.findSeason(String(existing.seasonRef));
    if (!season)
      throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (season.status !== "active")
      throw new AppError(
        "Completed match corrections are available only while the season is Active.",
        409,
        "SEASON_NOT_ACTIVE",
      );
    if (!season.matchRules)
      throw new AppError(
        "Match rules are unavailable for this historical season",
        409,
        "SEASON_RULES_UNAVAILABLE",
      );
    const correctedAt = new Date();
    const reusedGoalIds = new Set<string>();
    const correctedGoals = await Promise.all(
      input.goals.map(async (goal) => {
        const existingGoal = existing.goals.find((candidate) => {
          const candidateId = String(candidate._id);
          return (
            !reusedGoalIds.has(candidateId) &&
            String(candidate.scoringSeasonTeamRef) ===
              goal.scoringSeasonTeamRef &&
            String(candidate.scorerPlayerRef ?? "") ===
              (goal.scorerPlayerRef ?? "") &&
            candidate.goalType === goal.goalType
          );
        });
        if (existingGoal) {
          reusedGoalIds.add(String(existingGoal._id));
          const timingWasSupplied = goal.period != null || goal.minute != null || goal.addedMinutes != null;
          const existingHasTiming = existingGoal.period != null || existingGoal.minute != null;
          const timing = timingWasSupplied || existingHasTiming
            ? resolveMatchEventTiming(existing, goal, new Date(), existingGoal, true)
            : {};
          // Preserve unchanged historical player/team identities even when the
          // player was later inactivated or the sold-lot record is no longer live.
          // Any explicit timing correction still goes through clock validation.
          return { ...existingGoal, ...timing };
        }
        return {
          ...(await this.buildGoal(existing, goal, true)),
          _id: new Types.ObjectId(),
          createdAt: correctedAt,
        };
      }),
    );
    const shootout = input.penaltyShootout
      ? this.buildShootout(input.penaltyShootout)
      : null;
    if (shootout)
      await this.validateShootout(
        String(existing.seasonRef),
        existing,
        shootout,
      );
    const correctedMatch: SeasonMatchEntity = {
      ...existing,
      status: "completed",
      goals: correctedGoals,
      penaltyShootout: shootout,
      winnerSeasonTeamRef: null,
    };
    const correctedScoreBeforeWinner = this.score(correctedMatch);
    const winner = correctedMatch.stage === "group" && correctedScoreBeforeWinner.homeScore === correctedScoreBeforeWinner.awayScore
      ? null
      : this.calculateWinner(
          correctedMatch,
          season.matchRules,
          season.pointsRules,
        );
    correctedMatch.winnerSeasonTeamRef = winner;
    const rules = await import("./seasonMatch.completionRules.js");
    const originalScore = rules.deriveMatchScore(existing),
      correctedScore = rules.deriveMatchScore(correctedMatch);
    const snapshot = (
      match: SeasonMatchEntity,
      score: { homeScore: number; awayScore: number },
    ) => ({
      homeScore: score.homeScore,
      awayScore: score.awayScore,
      goals: match.goals.map((goal) => ({ ...goal })),
      penaltyShootout: match.penaltyShootout
        ? {
            ...match.penaltyShootout,
            kicks: match.penaltyShootout.kicks.map((kick) => ({ ...kick })),
          }
        : null,
      winnerSeasonTeamRef: match.winnerSeasonTeamRef,
    });
    const historyEntry: import("./seasonMatch.types.js").SeasonMatchCorrectionHistoryEntry =
      {
        reason,
        correctedBy: new Types.ObjectId(correctedBy),
        correctedAt,
        originalResult: snapshot(existing, originalScore),
        correctedResult: snapshot(correctedMatch, correctedScore),
      };
    const eventAuditEntries: MatchEventAuditHistoryEntry[] = [];
    const originalById = new Map(existing.goals.map((goal) => [String(goal._id), goal]));
    const correctedIds = new Set(correctedGoals.map((goal) => String(goal._id)));
    for (const goal of correctedGoals) {
      const previous = originalById.get(String(goal._id)) ?? null;
      eventAuditEntries.push(this.createGoalAuditEntry(goal, previous ? "updated" : "created", new Types.ObjectId(correctedBy), previous, reason));
    }
    for (const previous of existing.goals) {
      if (!correctedIds.has(String(previous._id))) eventAuditEntries.push(this.createGoalAuditEntry(previous, "deleted", new Types.ObjectId(correctedBy), previous, reason));
    }
    const saved = await this._seasonMatchRepo.correctCompletedMatch(
      id,
      existing.updatedAt,
      correctedGoals,
      shootout,
      winner,
      historyEntry,
      {
        action: "completed_match_correction",
        actor: new Types.ObjectId(correctedBy),
        timestamp: correctedAt,
        previousValue: this.auditSnapshot(existing),
        newValue: this.auditSnapshot(correctedMatch),
        reason,
      },
      eventAuditEntries,
    );
    if (!saved) throw new AppError("Match not found", 404, "MATCH_NOT_FOUND");
    const populated = await this._seasonMatchRepo.findPopulatedById(id);
    if (!populated)
      throw new AppError(
        "Corrected match could not be retrieved",
        500,
        "MATCH_CORRECTION_FAILED",
      );
    return this.map(populated);
  }

  async delete(id: string): Promise<void> {
    this.id(id, "match");
    const existing = await this._seasonMatchRepo.findById(id);
    if (!existing)
      throw new AppError("Match not found", 404, "MATCH_NOT_FOUND");
    if (existing.status !== "scheduled" && !(existing.status === "postponed" && !existing.actualStartedAt)) {
      throw new AppError("Only not-yet-started Scheduled or Postponed fixtures can be deleted.", 409, "MATCH_DELETE_NOT_ALLOWED");
    }
    if (hasRecordedMatchIncidents(existing))
      throw new AppError(
        "This match cannot be deleted because it contains recorded goals, cards, penalty-shootout events or correction history.",
        409,
        "MATCH_HAS_EVENTS",
      );
    const season = await this._seasonMatchRepo.findSeason(String(existing.seasonRef));
    if (!season)
      throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (season.status !== "active")
      throw new AppError(
        "Fixtures can only be deleted while the season is Active.",
        409,
        "SEASON_NOT_ACTIVE",
      );
    if (season.auctionLifecycleStatus !== "completed")
      throw new AppError(
        "Complete the auction before deleting fixtures.",
        409,
        "AUCTION_NOT_COMPLETED",
      );
    const deleted = await this._seasonMatchRepo.delete(id);
    if (!deleted) throw new AppError("Match not found", 404, "MATCH_NOT_FOUND");
  }

  async addCard(id: string, input: SeasonMatchCardDto, actor?: string): Promise<SeasonMatchResponseDto> {
    const match = await this.requireMatchAndActiveSeason(id);
    this.assertCardManagementAllowed(match);
    const actorId = this.requireEventActor(actor);
    const card = await this.buildCard(match, input);
    card._id = new Types.ObjectId();
    card.createdAt = new Date();
    const auditEntry = this.createCardAuditEntry(card, "created", actorId, null, this.auditReason(input.reason));
    const saved = await this._seasonMatchRepo.appendCard(id, card, match.updatedAt, auditEntry);
    if (!saved) throw new AppError("Match changed while the card was being recorded. Refresh and try again.", 409, "MATCH_EVENT_CONFLICT");
    const populated = await this._seasonMatchRepo.findPopulatedById(id);
    if (!populated) throw new AppError("Updated match could not be retrieved", 500, "MATCH_UPDATE_FAILED");
    return this.map(populated);
  }

  async updateCard(id: string, cardId: string, input: SeasonMatchCardDto, actor?: string): Promise<SeasonMatchResponseDto> {
    const actorId = this.requireEventActor(actor);
    const match = await this.requireMatchAndActiveSeason(id);
    this.assertCardManagementAllowed(match);
    this.id(cardId, "card");
    const old = (match.cards ?? []).find((card) => String(card._id) === cardId);
    if (!old) throw new AppError("Card not found", 404, "CARD_NOT_FOUND");
    const card = await this.buildCard(match, input, old);
    card._id = new Types.ObjectId(cardId);
    card.createdAt = old.createdAt ?? new Date();
    const auditEntry = this.createCardAuditEntry(card, "updated", actorId, old, this.auditReason(input.reason));
    const saved = await this._seasonMatchRepo.updateCard(id, cardId, card, match.updatedAt, auditEntry);
    if (!saved) throw new AppError("Match or Card changed while the correction was being saved. Refresh and try again.", 409, "MATCH_EVENT_CONFLICT");
    const populated = await this._seasonMatchRepo.findPopulatedById(id);
    if (!populated) throw new AppError("Updated match could not be retrieved", 500, "MATCH_UPDATE_FAILED");
    return this.map(populated);
  }

  async deleteCard(id: string, cardId: string, actor?: string, reason?: string): Promise<SeasonMatchResponseDto> {
    const actorId = this.requireEventActor(actor);
    const match = await this.requireMatchAndActiveSeason(id);
    this.assertCardManagementAllowed(match);
    this.id(cardId, "card");
    const old = (match.cards ?? []).find((card) => String(card._id) === cardId);
    if (!old) throw new AppError("Card not found", 404, "CARD_NOT_FOUND");
    const auditEntry = this.createCardAuditEntry(old, "deleted", actorId, old, this.auditReason(reason));
    const saved = await this._seasonMatchRepo.removeCard(id, cardId, match.updatedAt, auditEntry);
    if (!saved) throw new AppError("Match or Card changed while the deletion was being saved. Refresh and try again.", 409, "MATCH_EVENT_CONFLICT");
    const populated = await this._seasonMatchRepo.findPopulatedById(id);
    if (!populated) throw new AppError("Updated match could not be retrieved", 500, "MATCH_UPDATE_FAILED");
    return this.map(populated);
  }

  async addGoal(id: string, input: SeasonGoalDto, actor?: string): Promise<SeasonMatchResponseDto> {
    const match = await this.requireMatchAndActiveSeason(id);
    this.assertGoalManagementAllowed(match);
    const actorId = this.requireEventActor(actor);
    const goal = await this.buildGoal(match, input);
    goal._id = new Types.ObjectId();
    goal.createdAt = new Date();
    const goals = [...match.goals, goal];
    const season = await this._seasonMatchRepo.findSeason(String(match.seasonRef));
    if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (!season.matchRules) throw new AppError("Match rules are unavailable for this season", 409, "SEASON_RULES_UNAVAILABLE");
    const winner = this.calculateWinner({ ...match, goals }, season.matchRules, season.pointsRules);
    const auditEntry = this.createGoalAuditEntry(goal, "created", actorId, null, this.auditReason(input.reason));
    const saved = await this._seasonMatchRepo.appendGoalWithWinner(
      id,
      goal,
      winner ? new Types.ObjectId(String(winner)) : null,
      match.updatedAt,
      auditEntry,
    );
    if (!saved) throw new AppError("Match changed while the Goal was being recorded. Refresh and try again.", 409, "MATCH_EVENT_CONFLICT");
    const populated = await this._seasonMatchRepo.findPopulatedById(id);
    if (!populated) throw new AppError("Updated match could not be retrieved", 500, "MATCH_UPDATE_FAILED");
    return this.map(populated);
  }

  async updateGoal(id: string, goalId: string, input: SeasonGoalDto, actor?: string): Promise<SeasonMatchResponseDto> {
    const actorId = this.requireEventActor(actor);
    const match = await this.requireMatchAndActiveSeason(id);
    this.assertGoalManagementAllowed(match);
    this.id(goalId, "goal");
    const existingGoal = match.goals.find((goal) => String(goal._id) === goalId);
    if (!existingGoal) throw new AppError("Goal not found", 404, "GOAL_NOT_FOUND");
    const goal = await this.buildGoal(match, input, false, existingGoal);
    goal._id = existingGoal._id;
    goal.createdAt = existingGoal.createdAt ?? match.createdAt;
    const goals = match.goals.map((item) => String(item._id) === goalId ? goal : item);
    const season = await this._seasonMatchRepo.findSeason(String(match.seasonRef));
    if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (!season.matchRules) throw new AppError("Match rules are unavailable for this season", 409, "SEASON_RULES_UNAVAILABLE");
    const winner = this.calculateWinner({ ...match, goals }, season.matchRules, season.pointsRules);
    const auditEntry = this.createGoalAuditEntry(goal, "updated", actorId, existingGoal, this.auditReason(input.reason));
    const saved = await this._seasonMatchRepo.updateGoalWithWinner(
      id,
      goalId,
      goal,
      winner ? new Types.ObjectId(String(winner)) : null,
      match.updatedAt,
      auditEntry,
    );
    if (!saved) throw new AppError("Match or Goal changed while the correction was being saved. Refresh and try again.", 409, "MATCH_EVENT_CONFLICT");
    const populated = await this._seasonMatchRepo.findPopulatedById(id);
    if (!populated) throw new AppError("Updated match could not be retrieved", 500, "MATCH_UPDATE_FAILED");
    return this.map(populated);
  }

  async deleteGoal(id: string, goalId: string, actor?: string, reason?: string): Promise<SeasonMatchResponseDto> {
    const actorId = this.requireEventActor(actor);
    const match = await this.requireMatchAndActiveSeason(id);
    this.assertGoalManagementAllowed(match);
    this.id(goalId, "goal");
    const existingGoal = match.goals.find((goal) => String(goal._id) === goalId);
    if (!existingGoal) throw new AppError("Goal not found", 404, "GOAL_NOT_FOUND");
    const goals = match.goals.filter((goal) => String(goal._id) !== goalId);
    const season = await this._seasonMatchRepo.findSeason(String(match.seasonRef));
    if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    if (!season.matchRules) throw new AppError("Match rules are unavailable for this season", 409, "SEASON_RULES_UNAVAILABLE");
    const winner = this.calculateWinner({ ...match, goals }, season.matchRules, season.pointsRules);
    const auditEntry = this.createGoalAuditEntry(existingGoal, "deleted", actorId, existingGoal, this.auditReason(reason));
    const saved = await this._seasonMatchRepo.removeGoalWithWinner(
      id,
      goalId,
      winner ? new Types.ObjectId(String(winner)) : null,
      match.updatedAt,
      auditEntry,
    );
    if (!saved) throw new AppError("Match or Goal changed while the deletion was being saved. Refresh and try again.", 409, "MATCH_EVENT_CONFLICT");
    const populated = await this._seasonMatchRepo.findPopulatedById(id);
    if (!populated) throw new AppError("Updated match could not be retrieved", 500, "MATCH_UPDATE_FAILED");
    return this.map(populated);
  }

  private async validateKnockoutQualification(
    seasonId: string,
    stage: SeasonMatchFields["stage"],
    homeId: string,
    awayId: string,
    season: NonNullable<
      Awaited<ReturnType<SeasonMatchRepository["findSeason"]>>
    >,
  ): Promise<void> {
    if (stage === "group") return;
    const [teams, groupMatches, roundOf16, quarterFinals, semiFinals] =
      await Promise.all([
        this._seasonMatchRepo.findSeasonTeams(seasonId),
        this._seasonMatchRepo.findByStage(seasonId, "group"),
        this._seasonMatchRepo.findByStage(seasonId, "round_of_16"),
        this._seasonMatchRepo.findByStage(seasonId, "quarter_final"),
        this._seasonMatchRepo.findByStage(seasonId, "semi_final"),
      ]);
    let groupQualifiers = new Set<string>();
    if (season.groupStageEnabled !== false) {
      if (!season.pointsRules)
        throw new AppError(
          "Season points rules are required to validate group qualification",
          409,
          "SEASON_POINTS_RULES_UNAVAILABLE",
        );
      if (
        !groupMatches.length ||
        groupMatches.some(
          (match) =>
            !["completed", "cancelled", "abandoned"].includes(match.status),
        )
      )
        throw new AppError(
          "All group-stage fixtures must be resolved before knockout qualification can be confirmed",
          409,
          "GROUP_STAGE_NOT_COMPLETE",
        );
      groupQualifiers = groupStageQualifiers(
        teams,
        groupMatches,
        season.pointsRules,
        2,
      );
    }
    const activeTeamIds = new Set(
      teams
        .filter((team) => team.status === "active")
        .map((team) => String(team._id)),
    );
    const previousMatches =
      stage === "quarter_final"
        ? roundOf16
        : stage === "semi_final"
          ? quarterFinals.length
            ? quarterFinals
            : roundOf16
          : stage === "final" || stage === "third_place"
            ? semiFinals
            : [];
    if (previousMatches.length) {
      try {
        assertStageMatchesResolved(
          previousMatches,
          stage === "quarter_final"
            ? "Round of 16"
            : stage === "semi_final"
              ? quarterFinals.length
                ? "Quarter-final"
                : "Round of 16"
              : "Semi-final",
        );
      } catch (error) {
        throw new AppError(
          error instanceof Error
            ? error.message
            : "Previous knockout fixtures are not complete",
          409,
          "KNOCKOUT_STAGE_NOT_COMPLETE",
        );
      }
    }
    if ((stage === "final" || stage === "third_place") && !semiFinals.length)
      throw new AppError(
        "Semi-final fixtures must be recorded before creating the final or third-place playoff",
        409,
        "SEMI_FINALS_REQUIRED",
      );
    const eligible = qualifiedTeamsForStage(
      stage,
      groupQualifiers,
      activeTeamIds,
      roundOf16,
      quarterFinals,
      semiFinals,
    );
    if (!eligible.has(homeId) || !eligible.has(awayId))
      throw new AppError(
        "Both teams must have qualified for this knockout stage based on the completed group standings or previous knockout results",
        422,
        "KNOCKOUT_QUALIFICATION_REQUIRED",
      );
  }
  private async validateFixturePair(
    seasonId: string,
    stage: SeasonMatchFields["stage"],
    groupId: string | null,
    roundNumber: number,
    homeId: string,
    awayId: string,
    homeAndAway: boolean,
    excludeId?: string,
  ): Promise<void> {
    const fixtures = await this._seasonMatchRepo.findPairFixtures(
      seasonId,
      stage,
      stage === "group" ? groupId : null,
      homeId,
      awayId,
    );
    const issue = getPairFixtureError(
      fixtures,
      roundNumber,
      homeId,
      awayId,
      homeAndAway,
      excludeId,
    );
    if (issue === "DUPLICATE_PAIR_IN_ROUND")
      throw new AppError(
        "These two teams already have a fixture in this round. Reversing home and away does not create a separate round fixture.",
        409,
        issue,
        {
          roundNumber: "This team pairing already exists in the selected round",
        },
      );
    if (issue === "DUPLICATE_TEAM_PAIR")
      throw new AppError(
        "This team pairing already has a fixture. Enable Home and Away Fixtures in the season settings to schedule the return fixture.",
        409,
        issue,
        { homeSeasonTeamRef: "This team pair already has a fixture" },
      );
    if (issue === "PAIR_FIXTURE_LIMIT")
      throw new AppError(
        "A team pair can have at most two fixtures in a home-and-away season",
        409,
        issue,
      );
    if (issue === "DUPLICATE_HOME_AWAY_ORIENTATION")
      throw new AppError(
        "This home/away orientation already exists. The return fixture must reverse the home and away teams.",
        409,
        issue,
        {
          homeSeasonTeamRef:
            "Reverse the home and away teams for the return fixture",
        },
      );
  }
  private assertKickoffWithinSeason(
    season: NonNullable<
      Awaited<ReturnType<SeasonMatchRepository["findSeason"]>>
    >,
    kickoffAt: Date,
  ): void {
    if (
      !isKickoffWithinSeasonDateWindow(kickoffAt, {
        startDate: season.startDate,
        endDate: season.endDate,
        timeZone: season.timeZone,
      })
    ) {
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: season.timeZone,
      }).format(kickoffAt);
      const start = season.startDate
        ? season.startDate.toISOString().slice(0, 10)
        : null;
      const end = season.endDate
        ? season.endDate.toISOString().slice(0, 10)
        : null;
      if (start && day < start)
        throw new AppError(
          "Fixture date is before the season start date",
          422,
          "FIXTURE_BEFORE_SEASON",
          { kickoffAt: "Choose a fixture date on or after " + start },
        );
      throw new AppError(
        "Fixture date is after the season end date",
        422,
        "FIXTURE_AFTER_SEASON",
        { kickoffAt: "Choose a fixture date on or before " + end },
      );
    }
  }
  private async validateSeasonTeams(
    seasonId: string,
    homeId: string,
    awayId: string,
    stage: SeasonMatchFields["stage"],
    groupId: string | null,
  ): Promise<void> {
    if (homeId === awayId)
      throw new AppError("A team cannot play itself", 422, "SAME_TEAMS");
    const [home, away] = await Promise.all([
      this._seasonMatchRepo.findSeasonTeam(seasonId, homeId),
      this._seasonMatchRepo.findSeasonTeam(seasonId, awayId),
    ]);
    if (
      !home ||
      !away ||
      ["withdrawn", "eliminated", "completed"].includes(home.status) ||
      ["withdrawn", "eliminated", "completed"].includes(away.status)
    )
      throw new AppError(
        "Both teams must be participating in the selected season",
        422,
        "INVALID_SEASON_TEAMS",
      );
    if (
      stage !== "group" &&
      (home.status !== "active" || away.status !== "active")
    )
      throw new AppError(
        "Only Active season teams can be selected for knockout fixtures",
        422,
        "KNOCKOUT_TEAM_NOT_ACTIVE",
      );
    if (stage === "group") {
      if (!groupId)
        throw new AppError(
          "Group is required for a group-stage fixture",
          422,
          "GROUP_REQUIRED",
        );
      const group = await this._seasonMatchRepo.findGroup(seasonId, groupId);
      if (!group)
        throw new AppError(
          "Select a group from this season",
          422,
          "INVALID_GROUP",
        );
      if (
        String(home.groupRef) !== groupId ||
        String(away.groupRef) !== groupId
      )
        throw new AppError(
          "Both teams must be assigned to the selected group",
          422,
          "GROUP_MISMATCH",
        );
    } else if (groupId) {
      throw new AppError(
        "Knockout fixtures cannot belong to a group",
        422,
        "INVALID_GROUP_STAGE",
      );
    }
  }
  private assertGoalManagementAllowed(match: SeasonMatchEntity): void {
    if (match.status !== "live") {
      throw new AppError(
        "Goals can only be added, edited or removed while the match is Live. Existing goal records are preserved when a match changes status.",
        409,
        "MATCH_GOAL_MANAGEMENT_NOT_ALLOWED",
      );
    }
  }

  private assertCardManagementAllowed(match: SeasonMatchEntity): void {
    if (match.status !== "live")
      throw new AppError(
        "Cards can only be added, edited or removed while the match is Live.",
        409,
        "MATCH_CARD_MANAGEMENT_NOT_ALLOWED",
      );
  }
  private async buildCard(
    match: SeasonMatchEntity,
    input: SeasonMatchCardDto,
    existingTiming?: MatchEventTimingInput,
  ): Promise<SeasonMatchCardFields> {
    const teamId = input.seasonTeamRef;
    if (
      teamId !== String(match.homeSeasonTeamRef) &&
      teamId !== String(match.awaySeasonTeamRef)
    )
      throw new AppError(
        "Card recipient team must be one of the match participants",
        422,
        "INVALID_CARD_TEAM",
      );
    const [player, lot] = await Promise.all([
      this._seasonMatchRepo.findPlayer(input.playerRef),
      this._seasonMatchRepo.findSoldLot(String(match.seasonRef), input.playerRef),
    ]);
    if (
      !player ||
      player.status !== "active" ||
      !lot ||
      String(lot.seasonTeamRef) !== teamId
    )
      throw new AppError(
        "Card recipient must be an active player registered to the selected match team",
        422,
        "INVALID_CARD_PLAYER",
      );
    const timing = resolveMatchEventTiming(match, input, new Date(), existingTiming);
    return {
      seasonTeamRef: new Types.ObjectId(teamId),
      playerRef: new Types.ObjectId(input.playerRef),
      cardType: input.cardType,
      ...timing,
    };
  }
  private async buildGoal(
    match: SeasonMatchEntity,
    input: SeasonGoalDto,
    allowCompletedCorrection = false,
    existingTiming?: MatchEventTimingInput,
  ): Promise<SeasonMatchFields["goals"][number]> {
    // Preserve legacy completed-match goals that predate explicit period/minute
    // fields. Do not infer a historical event minute from createdAt.
    const preserveLegacyUntimedGoal = allowCompletedCorrection
      && existingTiming !== undefined
      && existingTiming.period == null
      && existingTiming.minute == null
      && input.period == null
      && input.minute == null;
    const timing = preserveLegacyUntimedGoal
      ? {}
      : resolveMatchEventTiming(match, input, new Date(), existingTiming, allowCompletedCorrection);
    const home = String(match.homeSeasonTeamRef),
      away = String(match.awaySeasonTeamRef),
      scoring = input.scoringSeasonTeamRef;
    if (scoring !== home && scoring !== away)
      throw new AppError(
        "Credited team must be one of the match participants",
        422,
        "INVALID_SCORING_TEAM",
      );
    if (input.goalType === "normal") {
      if (!input.scorerPlayerRef)
        throw new AppError("Select the goal scorer", 422, "SCORER_REQUIRED");
      const [player, lot] = await Promise.all([
        this._seasonMatchRepo.findPlayer(input.scorerPlayerRef),
        this._seasonMatchRepo.findSoldLot(String(match.seasonRef), input.scorerPlayerRef),
      ]);
      if (
        !player ||
        player.status !== "active" ||
        !lot ||
        String(lot.seasonTeamRef) !== scoring
      )
        throw new AppError(
          "Normal goal scorer must be an active player sold to the credited season team",
          422,
          "INVALID_SCORER",
        );
      return {
        scoringSeasonTeamRef: new Types.ObjectId(scoring),
        scorerPlayerRef: new Types.ObjectId(input.scorerPlayerRef),
        playerSeasonTeamRef: new Types.ObjectId(scoring),
        goalType:"normal", ...timing,
      };
    }
    if (!input.scorerPlayerRef)
      return {
        scoringSeasonTeamRef: new Types.ObjectId(scoring),
        scorerPlayerRef: null,
        playerSeasonTeamRef: null,
        goalType:"own_goal", ...timing,
      };
    const [player, lot] = await Promise.all([
      this._seasonMatchRepo.findPlayer(input.scorerPlayerRef),
      this._seasonMatchRepo.findSoldLot(String(match.seasonRef), input.scorerPlayerRef),
    ]);
    const responsibleTeam = scoring === home ? away : home;
    if (!player || !lot || String(lot.seasonTeamRef) !== responsibleTeam)
      throw new AppError(
        "Own-goal player must belong to the opposing season team",
        422,
        "INVALID_OWN_GOAL_PLAYER",
      );
    return {
      scoringSeasonTeamRef: new Types.ObjectId(scoring),
      scorerPlayerRef: new Types.ObjectId(input.scorerPlayerRef),
      playerSeasonTeamRef: new Types.ObjectId(responsibleTeam),
      goalType:"own_goal", ...timing,
    };
  }
  private buildShootout(
    input: import("./seasonMatch.dto.js").SeasonMatchShootoutInput | null | undefined,
  ): SeasonMatchFields["penaltyShootout"] {
    if (!input) return null;
    return {
      status: input.status,
      homeTeamScore: input.homeTeamScore,
      awayTeamScore: input.awayTeamScore,
      kicks: input.kicks.map((k) => ({
        seasonTeamRef: new Types.ObjectId(k.seasonTeamRef),
        playerRef: k.playerRef ? new Types.ObjectId(k.playerRef) : null,
        result: k.result,
      })),
    };
  }
  private async validateShootout(
    seasonId: string,
    match: SeasonMatchFields,
    shootout: NonNullable<SeasonMatchFields["penaltyShootout"]>,
  ): Promise<void> {
    assertPenaltyShootoutScore(match, shootout);
    for (const kick of shootout.kicks) {
      if (kick.playerRef) {
        const team = String(kick.seasonTeamRef);
        const lot = await this._seasonMatchRepo.findSoldLot(
          seasonId,
          String(kick.playerRef),
        );
        if (!lot || String(lot.seasonTeamRef) !== team)
          throw new AppError(
            "Shootout player must belong to the kicking team",
            422,
            "INVALID_SHOOTOUT_PLAYER",
          );
      }
    }
  }
  private calculateWinner(
    match: SeasonMatchFields,
    rules: {
      groupStageDrawAllowed:boolean;
    },
    pointsRules: import("../seasons/season.types.js").SeasonPointsRules | null,
  ): Types.ObjectId | null {
    const winner = calculateCompletedMatchWinner(match, rules, pointsRules);
    return winner ? new Types.ObjectId(winner) : null;
  }
  private mapTeam(ref: unknown): string | SeasonMatchTeamDto | null {
    if (!ref) return null;
    if (ref instanceof Types.ObjectId) return String(ref);
    const r = ref as any;
    if (!r.displayName) return String(r._id ?? r);
    const team =
      r.teamRef && typeof r.teamRef === "object" && r.teamRef.name
        ? {
            _id: String(r.teamRef._id),
            name: r.teamRef.name,
            shortName: r.teamRef.shortName,
            logo: r.teamRef.logo,
          }
        : null;
    return {
      _id: String(r._id),
      displayName: r.teamRef?.name ?? r.displayName,
      logoSnapshot: r.teamRef?.logo ?? r.logoSnapshot,
      team,
    };
  }
  private mapPlayer(ref: unknown): string | SeasonMatchPlayerDto | null {
    if (!ref) return null;
    if (ref instanceof Types.ObjectId) return String(ref);
    const p = ref as any;
    if (!p.name) return String(p._id ?? p);
    return { _id: String(p._id), name: p.name, profilePic: p.profilePic };
  }

  private mapGoal(
    g: PopulatedSeasonGoal,
    fallbackCreatedAt: Date,
  ): SeasonGoalResponseDto {
    return {
      _id: String(g._id),
      scoringSeasonTeamRef: this.mapTeam(g.scoringSeasonTeamRef)!,
      scorerPlayerRef: this.mapPlayer(g.scorerPlayerRef),
      playerSeasonTeamRef: this.mapTeam(g.playerSeasonTeamRef),
      goalType: g.goalType,
      period:g.period??null,minute:g.minute??null,addedMinutes:g.addedMinutes??0,
      // Older match records may not have timestamps on embedded goal documents.
      createdAt: (g.createdAt ?? fallbackCreatedAt).toISOString(),
    };
  }
  
  private mapCard(
    c: PopulatedSeasonMatchCard,
    fallbackCreatedAt: Date,
  ): SeasonMatchCardResponseDto {
    return {
      _id: String(c._id),
      seasonTeamRef: this.mapTeam(c.seasonTeamRef)!,
      playerRef: this.mapPlayer(c.playerRef)!,
      cardType: c.cardType,
      period:c.period??null,minute:c.minute??null,addedMinutes:c.addedMinutes??0,
      createdAt: (c.createdAt ?? fallbackCreatedAt).toISOString(),
    };
  }
  private mapAuditSnapshot(snapshot: MatchAuditSnapshot): MatchAuditSnapshotDto {
    return {
      ...(snapshot.status !== undefined ? { status: snapshot.status } : {}),
      ...(snapshot.phase !== undefined ? { phase: snapshot.phase } : {}),
      ...(snapshot.actualStartedAt !== undefined ? { actualStartedAt: snapshot.actualStartedAt?.toISOString() ?? null } : {}),
      ...(snapshot.clock ? {
        clock: {
          isRunning: snapshot.clock.isRunning,
          clockStartedAt: snapshot.clock.clockStartedAt?.toISOString() ?? null,
          periodElapsedSecondsByPeriod: { ...snapshot.clock.periodElapsedSecondsByPeriod },
        },
      } : {}),
      ...(snapshot.decidingRules ? {
        decidingRules: {
          extraTime: { ...snapshot.decidingRules.extraTime },
          penaltyShootout: { ...snapshot.decidingRules.penaltyShootout },
        },
      } : {}),
      ...(snapshot.kickoffAt ? { kickoffAt: snapshot.kickoffAt.toISOString() } : {}),
      ...(snapshot.winnerSeasonTeamRef !== undefined ? {
        winnerSeasonTeamRef: snapshot.winnerSeasonTeamRef ? String(snapshot.winnerSeasonTeamRef) : null,
      } : {}),
      ...(snapshot.penaltyShootout !== undefined ? {
        penaltyShootout: snapshot.penaltyShootout ? {
          status: snapshot.penaltyShootout.status,
          homeTeamScore: snapshot.penaltyShootout.homeTeamScore,
          awayTeamScore: snapshot.penaltyShootout.awayTeamScore,
          kicks: snapshot.penaltyShootout.kicks.map(kick => ({
            seasonTeamRef: String(kick.seasonTeamRef),
            playerRef: kick.playerRef ? String(kick.playerRef) : null,
            result: kick.result,
          })),
        } : null,
      } : {}),
      ...(snapshot.score ? { score: { ...snapshot.score } } : {}),
    };
  }

  private map(m: PopulatedSeasonMatch): SeasonMatchResponseDto {
    const venue =
      m.venueRef &&
      !(m.venueRef instanceof Types.ObjectId) &&
      typeof m.venueRef === "object"
        ? {
            _id: String(m.venueRef._id),
            name: m.venueRef.name,
            location: m.venueRef.location,
          }
        : String(m.venueRef);
    return {
      _id: String(m._id),
      seasonRef: String(m.seasonRef),
      matchNumber: m.matchNumber,
      roundNumber: m.roundNumber,
      stage: m.stage,
      groupRef: m.groupRef ? String(m.groupRef) : null,
      kickoffAt: m.kickoffAt.toISOString(),
      venueRef: venue,
      venue: typeof venue === "string" ? null : venue.name,
      homeSeasonTeamRef: this.mapTeam(m.homeSeasonTeamRef)!,
      awaySeasonTeamRef: this.mapTeam(m.awaySeasonTeamRef)!,
      status:m.status,
      matchDurationMinutes:m.matchDurationMinutes??30,
      decidingRules:m.decidingRules??{extraTime:{isAllowed:false,durationMinutes:10},penaltyShootout:{isAllowed:m.stage!=="group"}},
      actualStartedAt:m.actualStartedAt?.toISOString()??null,
      phase:m.phase??null,
      clock:{isRunning:m.clock?.isRunning??false,clockStartedAt:m.clock?.clockStartedAt?.toISOString()??null,periodElapsedSecondsByPeriod:{
        firstHalf:m.clock?.periodElapsedSecondsByPeriod?.firstHalf??0,secondHalf:m.clock?.periodElapsedSecondsByPeriod?.secondHalf??0,
        extraTimeFirstHalf:m.clock?.periodElapsedSecondsByPeriod?.extraTimeFirstHalf??0,extraTimeSecondHalf:m.clock?.periodElapsedSecondsByPeriod?.extraTimeSecondHalf??0}},
      goals: m.goals.map((g) => this.mapGoal(g, m.createdAt)),
      cards: (m.cards ?? []).map((c) => this.mapCard(c, m.createdAt)),
      resolutionHistory: (m.resolutionHistory ?? []).map((entry) => ({
        status: entry.status,
        reason: entry.reason,
        decidedAt: entry.decidedAt.toISOString(),
      })),
      statusHistory: (m.statusHistory ?? []).map((entry) => ({
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        reason: entry.reason ?? null,
        changedBy: String(entry.changedBy),
        changedAt: entry.changedAt.toISOString(),
        fromKickoffAt: entry.fromKickoffAt?.toISOString() ?? null,
        toKickoffAt: entry.toKickoffAt?.toISOString() ?? null,
      })),
      correctionHistory: (m.correctionHistory ?? []).map((entry) => ({
        reason: entry.reason,
        correctedBy: String(entry.correctedBy),
        correctedAt: entry.correctedAt.toISOString(),
        originalResult: {
          homeScore: entry.originalResult.homeScore,
          awayScore: entry.originalResult.awayScore,
          goals: entry.originalResult.goals.map((g) => ({
            _id: String(g._id),
            scoringSeasonTeamRef: String(g.scoringSeasonTeamRef),
            scorerPlayerRef: g.scorerPlayerRef
              ? String(g.scorerPlayerRef)
              : null,
            playerSeasonTeamRef: g.playerSeasonTeamRef
              ? String(g.playerSeasonTeamRef)
              : null,
            goalType:g.goalType,period:g.period??null,minute:g.minute??null,addedMinutes:g.addedMinutes??0,
            createdAt:
              g.createdAt?.toISOString() ?? entry.correctedAt.toISOString(),
          })),
          penaltyShootout: entry.originalResult.penaltyShootout
            ? {
                ...entry.originalResult.penaltyShootout,
                kicks: entry.originalResult.penaltyShootout.kicks.map((k) => ({
                  seasonTeamRef: String(k.seasonTeamRef),
                  playerRef: k.playerRef ? String(k.playerRef) : null,
                  result: k.result,
                })),
              }
            : null,
          winnerSeasonTeamRef: entry.originalResult.winnerSeasonTeamRef
            ? String(entry.originalResult.winnerSeasonTeamRef)
            : null,
        },
        correctedResult: {
          homeScore: entry.correctedResult.homeScore,
          awayScore: entry.correctedResult.awayScore,
          goals: entry.correctedResult.goals.map((g) => ({
            _id: String(g._id),
            scoringSeasonTeamRef: String(g.scoringSeasonTeamRef),
            scorerPlayerRef: g.scorerPlayerRef
              ? String(g.scorerPlayerRef)
              : null,
            playerSeasonTeamRef: g.playerSeasonTeamRef
              ? String(g.playerSeasonTeamRef)
              : null,
            goalType: g.goalType,
            period: g.period ?? null,
            minute: g.minute ?? null,
            addedMinutes: g.addedMinutes ?? 0,
            createdAt:
              g.createdAt?.toISOString() ?? entry.correctedAt.toISOString(),
          })),
          penaltyShootout: entry.correctedResult.penaltyShootout
            ? {
                ...entry.correctedResult.penaltyShootout,
                kicks: entry.correctedResult.penaltyShootout.kicks.map((k) => ({
                  seasonTeamRef: String(k.seasonTeamRef),
                  playerRef: k.playerRef ? String(k.playerRef) : null,
                  result: k.result,
                })),
              }
            : null,
          winnerSeasonTeamRef: entry.correctedResult.winnerSeasonTeamRef
            ? String(entry.correctedResult.winnerSeasonTeamRef)
            : null,
        },
      })),
      penaltyShootout: m.penaltyShootout
        ? {
            status: m.penaltyShootout.status,
            homeTeamScore: m.penaltyShootout.homeTeamScore,
            awayTeamScore: m.penaltyShootout.awayTeamScore,
            kicks: m.penaltyShootout.kicks.map((k) => ({
              seasonTeamRef: String(k.seasonTeamRef),
              playerRef: k.playerRef ? String(k.playerRef) : null,
              result: k.result,
            })),
          }
        : null,
      winnerSeasonTeamRef: this.mapTeam(m.winnerSeasonTeamRef),
      notes: m.notes,
      eventAuditHistory: (m.eventAuditHistory ?? []).map((entry) => ({
        eventId: String(entry.eventId),
        eventType: entry.eventType,
        operation: entry.operation,
        actor: String(entry.actor),
        timestamp: entry.timestamp.toISOString(),
        previousValue: this.mapEventAuditValue(entry.previousValue),
        newValue: this.mapEventAuditValue(entry.newValue),
        reason: entry.reason ?? null,
      })),
      auditHistory: (m.auditHistory ?? []).map((entry) => ({
        action: entry.action,
        actor: String(entry.actor),
        timestamp: entry.timestamp.toISOString(),
        previousValue: this.mapAuditSnapshot(entry.previousValue),
        newValue: this.mapAuditSnapshot(entry.newValue),
        reason: entry.reason ?? null,
      })),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }
  private async getExisting(id: string): Promise<SeasonMatchEntity> {
    this.id(id, "match");
    const match = await this._seasonMatchRepo.findById(id);
    if (!match) throw new AppError("Match not found", 404, "MATCH_NOT_FOUND");
    const season = await this._seasonMatchRepo.findSeason(String(match.seasonRef));
    if (!season)
      throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
    return match;
  }
  private requireEventActor(actor?: string): Types.ObjectId {
    if (!actor || !Types.ObjectId.isValid(actor)) {
      throw new AppError("An authenticated administrator is required for Match event operations.", 401, "UNAUTHENTICATED");
    }
    return new Types.ObjectId(actor);
  }

  private auditReason(reason?: string): string | null {
    const normalized = reason?.trim() ?? "";
    if (normalized && (normalized.length < 3 || normalized.length > 1000)) {
      throw new AppError("Event audit reason must be between 3 and 1000 characters.", 422, "MATCH_EVENT_AUDIT_REASON_INVALID");
    }
    return normalized || null;
  }

  private createGoalAuditEntry(
    goal: SeasonGoalFields,
    operation: "created" | "updated" | "deleted",
    actor: Types.ObjectId,
    previous: SeasonGoalFields | null,
    reason: string | null,
  ): MatchEventAuditHistoryEntry {
    if (!goal._id) throw new AppError("Goal identity is required for event auditing.", 500, "MATCH_EVENT_AUDIT_INVALID");
    const toValue = (value: SeasonGoalFields | null): MatchEventAuditValue | null => value ? ({
      eventType: "goal",
      eventId: value._id!,
      scoringSeasonTeamRef: value.scoringSeasonTeamRef,
      scorerPlayerRef: value.scorerPlayerRef,
      playerSeasonTeamRef: value.playerSeasonTeamRef,
      goalType: value.goalType,
      period: value.period ?? null,
      minute: value.minute ?? null,
      addedMinutes: value.addedMinutes ?? 0,
      createdAt: value.createdAt ?? null,
    }) : null;
    return {
      eventId: goal._id,
      eventType: "goal",
      operation,
      actor,
      timestamp: new Date(),
      previousValue: toValue(previous),
      newValue: operation === "deleted" ? null : toValue(goal),
      reason,
    };
  }

  private createCardAuditEntry(
    card: SeasonMatchCardFields,
    operation: "created" | "updated" | "deleted",
    actor: Types.ObjectId,
    previous: SeasonMatchCardFields | null,
    reason: string | null,
  ): MatchEventAuditHistoryEntry {
    if (!card._id) throw new AppError("Card identity is required for event auditing.", 500, "MATCH_EVENT_AUDIT_INVALID");
    const toValue = (value: SeasonMatchCardFields | null): MatchEventAuditValue | null => value ? ({
      eventType: "card",
      eventId: value._id!,
      seasonTeamRef: value.seasonTeamRef,
      playerRef: value.playerRef,
      cardType: value.cardType,
      period: value.period ?? null,
      minute: value.minute ?? null,
      addedMinutes: value.addedMinutes ?? 0,
      createdAt: value.createdAt ?? null,
    }) : null;
    return {
      eventId: card._id,
      eventType: "card",
      operation,
      actor,
      timestamp: new Date(),
      previousValue: toValue(previous),
      newValue: operation === "deleted" ? null : toValue(card),
      reason,
    };
  }

  private mapEventAuditValue(value: MatchEventAuditValue | null): import("./seasonMatch.dto.js").MatchEventAuditValueDto | null {
    if (!value) return null;
    if (value.eventType === "goal") {
      return {
        eventType: "goal",
        eventId: String(value.eventId),
        scoringSeasonTeamRef: String(value.scoringSeasonTeamRef),
        scorerPlayerRef: value.scorerPlayerRef ? String(value.scorerPlayerRef) : null,
        playerSeasonTeamRef: value.playerSeasonTeamRef ? String(value.playerSeasonTeamRef) : null,
        goalType: value.goalType,
        period: value.period ?? null,
        minute: value.minute ?? null,
        addedMinutes: value.addedMinutes ?? 0,
        createdAt: value.createdAt?.toISOString() ?? null,
      };
    }
    return {
      eventType: "card",
      eventId: String(value.eventId),
      seasonTeamRef: String(value.seasonTeamRef),
      playerRef: String(value.playerRef),
      cardType: value.cardType,
      period: value.period ?? null,
      minute: value.minute ?? null,
      addedMinutes: value.addedMinutes ?? 0,
      createdAt: value.createdAt?.toISOString() ?? null,
    };
  }

  private id(value: string, label: string) {
    if (!Types.ObjectId.isValid(value))
      throw new AppError("Invalid " + label + " ID", 400, "INVALID_ID");
  }
}
