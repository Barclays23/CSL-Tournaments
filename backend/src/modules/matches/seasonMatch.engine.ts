import { AppError } from "../../shared/errors/appError.js";
import type { MatchClock, MatchTimedPeriod, SeasonMatchEntity, SeasonMatchFields, MatchAuditHistoryEntry } from "./seasonMatch.types.js";

export const MATCH_PHASES = [
  "first_half", "half_time", "second_half", "regular_full_time",
  "extra_time_first_half", "extra_time_half_time", "extra_time_second_half",
  "extra_time_completed", "penalty_shootout", "penalty_shootout_completed", "full_time",
] as const;

export const MATCH_PHASE_ACTIONS = [
  "half_time", "start_second_half", "regular_full_time", "start_extra_time",
  "extra_time_half_time", "start_extra_time_second_half", "end_extra_time",
  "start_penalty_shootout", "complete_penalty_shootout",
] as const;

export type MatchPhaseAction = typeof MATCH_PHASE_ACTIONS[number];
export interface MatchEventTimingInput { period?: MatchTimedPeriod | null; minute?: number | null; addedMinutes?: number | null; }
export interface ResolvedMatchEventTiming { period: MatchTimedPeriod; minute: number; addedMinutes: number; }

export const MATCH_TIMED_PERIODS: readonly MatchTimedPeriod[] = [
  "first_half", "second_half", "extra_time_first_half", "extra_time_second_half",
];

export const MATCH_PERIOD_CLOCK_KEYS: Record<MatchTimedPeriod, keyof MatchClock["periodElapsedSecondsByPeriod"]> = {
  first_half: "firstHalf",
  second_half: "secondHalf",
  extra_time_first_half: "extraTimeFirstHalf",
  extra_time_second_half: "extraTimeSecondHalf",
};

export const MATCH_PERIOD_INDEX: Record<MatchTimedPeriod, number> = {
  first_half: 0,
  second_half: 1,
  extra_time_first_half: 2,
  extra_time_second_half: 3,
};

export function getTimedPeriodForPhase(phase: SeasonMatchFields["phase"]): MatchTimedPeriod | null {
  switch (phase) {
    case "first_half": return "first_half";
    case "second_half": return "second_half";
    case "extra_time_first_half": return "extra_time_first_half";
    case "extra_time_second_half": return "extra_time_second_half";
    default: return null;
  }
}

function hasExtraTimeStarted(match: Pick<SeasonMatchEntity, "phase" | "decidingRules"> & Partial<Pick<SeasonMatchEntity, "clock" | "auditHistory">>): boolean {
  if (match.phase && ["extra_time_first_half", "extra_time_half_time", "extra_time_second_half", "extra_time_completed"].includes(match.phase)) return true;
  if ((match.clock?.periodElapsedSecondsByPeriod.extraTimeFirstHalf ?? 0) > 0
    || (match.clock?.periodElapsedSecondsByPeriod.extraTimeSecondHalf ?? 0) > 0) return true;
  return (match.auditHistory ?? []).some((entry: MatchAuditHistoryEntry) =>
    ["phase_transition", "phase_correction"].includes(entry.action)
    && ["extra_time_first_half", "extra_time_half_time", "extra_time_second_half", "extra_time_completed"].includes(entry.newValue.phase ?? ""),
  );
}

export function getLastAvailablePeriodIndex(
  match: Pick<SeasonMatchEntity, "phase" | "decidingRules"> & Partial<Pick<SeasonMatchEntity, "clock" | "auditHistory">>,
): number {
  switch (match.phase) {
    case "first_half":
    case "half_time": return 0;
    case "second_half":
    case "regular_full_time": return 1;
    case "extra_time_first_half":
    case "extra_time_half_time": return 2;
    case "extra_time_second_half":
    case "extra_time_completed": return 3;
    case "penalty_shootout":
    case "penalty_shootout_completed":
    case "full_time": return hasExtraTimeStarted(match) ? 3 : 1;
    default: return -1;
  }
}

export function getPeriodElapsedSeconds(
  match: Pick<SeasonMatchEntity, "phase" | "clock">,
  period: MatchTimedPeriod,
  now = new Date(),
): number {
  const stored = match.clock.periodElapsedSecondsByPeriod[MATCH_PERIOD_CLOCK_KEYS[period]] ?? 0;
  if (getTimedPeriodForPhase(match.phase) !== period || !match.clock.isRunning) return stored;
  if (!match.clock.clockStartedAt) {
    throw new AppError("The running match clock has no server start timestamp.", 409, "MATCH_CLOCK_INVALID");
  }
  return stored + Math.max(0, Math.floor((now.getTime() - match.clock.clockStartedAt.getTime()) / 1000));
}

export function getClockElapsedSeconds(match: Pick<SeasonMatchEntity, "phase" | "clock">, now = new Date()): number {
  const period = getTimedPeriodForPhase(match.phase);
  return period ? getPeriodElapsedSeconds(match, period, now) : 0;
}

export function startTimedPeriodClock(clock: MatchClock, phase: SeasonMatchFields["phase"], serverNow: Date): MatchClock {
  if (!getTimedPeriodForPhase(phase)) {
    throw new AppError("The current Match phase does not run a clock.", 409, "MATCH_CLOCK_PHASE_INVALID");
  }
  if (clock.isRunning || clock.clockStartedAt) {
    throw new AppError("The match clock is already running or has an active segment.", 409, "MATCH_CLOCK_ALREADY_RUNNING");
  }
  return { ...clock, isRunning: true, clockStartedAt: serverNow };
}

/** Stops the current period. An already-paused period remains stopped at its stored elapsed value. */
export function stopTimedPeriodClock(match: Pick<SeasonMatchEntity, "phase" | "clock">, serverNow: Date): MatchClock {
  const period = getTimedPeriodForPhase(match.phase);
  if (!period) {
    throw new AppError("The current Match phase does not run a clock.", 409, "MATCH_CLOCK_PHASE_INVALID");
  }
  if (!match.clock.isRunning) {
    if (match.clock.clockStartedAt) {
      throw new AppError("The stopped match clock cannot retain a running segment timestamp.", 409, "MATCH_CLOCK_INVALID");
    }
    return match.clock;
  }
  if (!match.clock.clockStartedAt) {
    throw new AppError("The running match clock has no server start timestamp.", 409, "MATCH_CLOCK_INVALID");
  }
  return {
    ...match.clock,
    isRunning: false,
    clockStartedAt: null,
    periodElapsedSecondsByPeriod: {
      ...match.clock.periodElapsedSecondsByPeriod,
      [MATCH_PERIOD_CLOCK_KEYS[period]]: getPeriodElapsedSeconds(match, period, serverNow),
    },
  };
}

export function periodBaseMinutes(
  match: Pick<SeasonMatchEntity, "matchDurationMinutes" | "decidingRules">,
  period: MatchTimedPeriod,
): number {
  const regularHalf = match.matchDurationMinutes / 2;
  const extraHalf = match.decidingRules.extraTime.durationMinutes / 2;
  switch (period) {
    case "first_half": return 0;
    case "second_half": return regularHalf;
    case "extra_time_first_half": return match.matchDurationMinutes;
    case "extra_time_second_half": return match.matchDurationMinutes + extraHalf;
  }
}

export function periodLengthMinutes(
  match: Pick<SeasonMatchEntity, "matchDurationMinutes" | "decidingRules">,
  period: MatchTimedPeriod,
): number {
  return period.startsWith("extra_time_")
    ? match.decidingRules.extraTime.durationMinutes / 2
    : match.matchDurationMinutes / 2;
}

function defaultMinuteAndAdded(
  match: Pick<SeasonMatchEntity, "matchDurationMinutes" | "decidingRules">,
  period: MatchTimedPeriod,
  elapsedSeconds: number,
): { minute: number; addedMinutes: number } {
  const base = periodBaseMinutes(match, period);
  const nominalSeconds = periodLengthMinutes(match, period) * 60;
  const boundary = base + nominalSeconds / 60;
  if (elapsedSeconds <= nominalSeconds) {
    return { minute: Math.max(base + 1, base + Math.floor(elapsedSeconds / 60)), addedMinutes: 0 };
  }
  // Added-time event minutes represent completed elapsed minutes, not the
  // minute currently in progress. At 15+01:20, 15+1' is valid but 15+2'
  // would be ahead of the server clock.
  return { minute: boundary, addedMinutes: Math.floor((elapsedSeconds - nominalSeconds) / 60) };
}

/**
 * Resolves event time using the server clock. Completed matches are accepted only
 * for the dedicated audited correction workflow and require explicit time for new events.
 */
export function resolveMatchEventTiming(
  match: SeasonMatchEntity,
  input: MatchEventTimingInput,
  now = new Date(),
  existing?: MatchEventTimingInput,
  allowCompletedCorrection = false,
): ResolvedMatchEventTiming {
  const isLive = match.status === "live" && Boolean(match.actualStartedAt);
  const isCompletedCorrection = allowCompletedCorrection
    && match.status === "completed"
    && match.phase === "full_time"
    && !match.clock.isRunning
    && !match.clock.clockStartedAt
    && Boolean(match.actualStartedAt);

  if (!isLive && !isCompletedCorrection) {
    throw new AppError(
      "Timed goals and cards can only be changed during a Live match or through the audited completed-match correction workflow.",
      409,
      "MATCH_EVENT_MANAGEMENT_NOT_ALLOWED",
    );
  }

  const maxIndex = getLastAvailablePeriodIndex(match);
  const phasePeriod = getTimedPeriodForPhase(match.phase);
  const isShootoutPhase = match.phase === "penalty_shootout" || match.phase === "penalty_shootout_completed";
  if (!isCompletedCorrection && match.phase === "full_time") {
    throw new AppError("Normal timed events cannot be recorded after the Match is completed.", 409, "MATCH_TIMED_EVENTS_CLOSED");
  }
  const requestedPeriod = input.period ?? existing?.period ?? undefined;
  // A shootout has no running timed period. Corrections must explicitly target
  // a period that has already been played; getLastAvailablePeriodIndex rejects ET
  // when it was never started.
  const defaultPeriod = isCompletedCorrection || isShootoutPhase
    ? undefined
    : phasePeriod ?? (maxIndex >= 0 ? MATCH_TIMED_PERIODS[maxIndex] : undefined);
  if (!defaultPeriod && !requestedPeriod) {
    throw new AppError("Choose a completed Match period for this event.", 422, "MATCH_EVENT_PERIOD_REQUIRED");
  }
  const period = requestedPeriod ?? defaultPeriod;
  if (!period) throw new AppError("Start the match before recording a timed event.", 409, "MATCH_PHASE_NOT_STARTED");

  const index = MATCH_PERIOD_INDEX[period];
  if (index === undefined || index > maxIndex) {
    throw new AppError("An event cannot be assigned to a future Match period.", 422, "MATCH_EVENT_FUTURE_PERIOD");
  }

  const elapsedSeconds = getPeriodElapsedSeconds(match, period, now);
  const defaults = defaultMinuteAndAdded(match, period, elapsedSeconds);
  const minute = input.minute ?? existing?.minute ?? (isCompletedCorrection ? null : defaults.minute);
  const eventTimeChanged = Boolean(existing && (
    (input.period !== undefined && input.period !== existing.period)
    || (input.minute !== undefined && input.minute !== existing.minute)
  ));
  const addedMinutes = input.addedMinutes
    ?? (eventTimeChanged ? 0
      : existing?.addedMinutes !== undefined ? existing.addedMinutes
      : input.minute === undefined && !isCompletedCorrection ? defaults.addedMinutes : 0);

  if (minute === null || !Number.isSafeInteger(minute)) {
    throw new AppError("Enter an event minute when correcting a completed match.", 422, "MATCH_EVENT_MINUTE_REQUIRED");
  }

  const base = periodBaseMinutes(match, period);
  const boundary = base + periodLengthMinutes(match, period);
  if (minute <= base || minute > boundary) {
    throw new AppError("Enter a valid cumulative match minute within the selected period.", 422, "INVALID_MATCH_EVENT_TIME", {
      minute: "Minute is outside the selected period",
    });
  }
  if (!Number.isSafeInteger(addedMinutes) || addedMinutes < 0 || (addedMinutes > 0 && minute !== boundary)) {
    throw new AppError("Added minutes are valid only at the nominal end of a period.", 422, "INVALID_MATCH_EVENT_ADDED_TIME", {
      addedMinutes: "Use added minutes only at the period boundary",
    });
  }
  const isStoppageEvent = minute === boundary && addedMinutes > 0;
  const eventElapsed = isStoppageEvent
    ? periodLengthMinutes(match, period) * 60 + addedMinutes * 60
    : minute === base + 1 ? 0 : (minute - base) * 60;
  const laterThanClock = eventElapsed > elapsedSeconds;
  if (laterThanClock) {
    throw new AppError("The event time is later than the stored/current Match clock position.", 422, "MATCH_EVENT_IN_FUTURE", {
      minute: "An event cannot be recorded ahead of the match clock",
    });
  }
  return { period, minute, addedMinutes };
}

export function eventElapsedSeconds(
  match: Pick<SeasonMatchEntity, "matchDurationMinutes" | "decidingRules">,
  timing: MatchEventTimingInput,
): number | null {
  if (!timing.period || timing.minute === undefined || timing.minute === null) return null;
  const base = periodBaseMinutes(match, timing.period);
  if (timing.addedMinutes && timing.addedMinutes > 0) {
    return periodLengthMinutes(match, timing.period) * 60 + timing.addedMinutes * 60;
  }
  return timing.minute === base + 1 ? 0 : (timing.minute - base) * 60;
}

export function periodOrder(period: MatchTimedPeriod): number {
  return MATCH_PERIOD_INDEX[period];
}
