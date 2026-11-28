import type { MatchPhaseAction, MatchTimedPeriod } from "@/types/seasonMatch.types";
import type { MockSeasonMatch } from "@/mocks/seasonSeed";
import type { MockFail } from "@/mocks/matchLifecycleRules";

export const MOCK_TIMED_PERIODS: readonly MatchTimedPeriod[] = [
  "first_half", "second_half", "extra_time_first_half", "extra_time_second_half",
];
const CLOCK_KEY: Record<MatchTimedPeriod, "firstHalf" | "secondHalf" | "extraTimeFirstHalf" | "extraTimeSecondHalf"> = {
  first_half: "firstHalf",
  second_half: "secondHalf",
  extra_time_first_half: "extraTimeFirstHalf",
  extra_time_second_half: "extraTimeSecondHalf",
};
const PERIOD_INDEX: Record<MatchTimedPeriod, number> = {
  first_half: 0, second_half: 1, extra_time_first_half: 2, extra_time_second_half: 3,
};

export type MockEventTimingInput = { period?: MatchTimedPeriod | null; minute?: number | null; addedMinutes?: number | null };

export function mockTimedPeriodForPhase(phase: MockSeasonMatch["phase"]): MatchTimedPeriod | null {
  if (phase === "first_half") return "first_half";
  if (phase === "second_half") return "second_half";
  if (phase === "extra_time_first_half") return "extra_time_first_half";
  if (phase === "extra_time_second_half") return "extra_time_second_half";
  return null;
}

export function mockPeriodBaseMinutes(match: MockSeasonMatch, period: MatchTimedPeriod): number {
  const half = match.matchDurationMinutes / 2;
  const extraHalf = match.decidingRules.extraTime.durationMinutes / 2;
  switch (period) {
    case "first_half": return 0;
    case "second_half": return half;
    case "extra_time_first_half": return match.matchDurationMinutes;
    case "extra_time_second_half": return match.matchDurationMinutes + extraHalf;
  }
}

export function mockPeriodLengthMinutes(match: MockSeasonMatch, period: MatchTimedPeriod): number {
  return period.startsWith("extra_time_")
    ? match.decidingRules.extraTime.durationMinutes / 2
    : match.matchDurationMinutes / 2;
}

export function mockPeriodElapsedSeconds(match: MockSeasonMatch, period: MatchTimedPeriod, nowMs = Date.now()): number {
  const stored = match.clock.periodElapsedSecondsByPeriod[CLOCK_KEY[period]] ?? 0;
  if (mockTimedPeriodForPhase(match.phase) !== period || !match.clock.isRunning || !match.clock.clockStartedAt) return stored;
  const startedAt = new Date(match.clock.clockStartedAt).getTime();
  return Number.isFinite(startedAt) ? stored + Math.max(0, Math.floor((nowMs - startedAt) / 1000)) : stored;
}

export function mockLastPlayedPeriodIndex(match: MockSeasonMatch): number {
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
    case "full_time":
      return match.clock.periodElapsedSecondsByPeriod.extraTimeFirstHalf > 0
        || match.clock.periodElapsedSecondsByPeriod.extraTimeSecondHalf > 0
        || (match.auditHistory ?? []).some((entry) =>
          ["phase_transition", "phase_correction"].includes(entry.action)
          && ["extra_time_first_half", "extra_time_half_time", "extra_time_second_half", "extra_time_completed"].includes(String(entry.newValue.phase ?? "")))
        ? 3 : 1;
    default: return -1;
  }
}

export function resolveMockEventTiming(
  match: MockSeasonMatch,
  input: MockEventTimingInput,
  fail: MockFail,
  nowMs = Date.now(),
  existing?: MockEventTimingInput,
  allowCompletedCorrection = false,
): { period: MatchTimedPeriod; minute: number; addedMinutes: number } {
  const isLive = match.status === "live" && Boolean(match.actualStartedAt);
  const isCompletedCorrection = allowCompletedCorrection
    && match.status === "completed"
    && match.phase === "full_time"
    && Boolean(match.actualStartedAt)
    && !match.clock.isRunning
    && !match.clock.clockStartedAt;
  if (!isLive && !isCompletedCorrection) {
    fail(409, "Timed goals and cards can only be managed during a Live Match.", "MATCH_EVENT_MANAGEMENT_NOT_ALLOWED");
  }
  const lastIndex = mockLastPlayedPeriodIndex(match);
  const phasePeriod = mockTimedPeriodForPhase(match.phase);
  const inShootout = match.phase === "penalty_shootout" || match.phase === "penalty_shootout_completed";
  const requestedPeriod = input.period ?? existing?.period ?? undefined;
  const defaultPeriod = isCompletedCorrection || inShootout
    ? undefined
    : phasePeriod ?? (lastIndex >= 0 ? MOCK_TIMED_PERIODS[lastIndex] : undefined);
  const period = requestedPeriod ?? defaultPeriod;
  if (!period) fail(422, "Choose a completed Match period for this event.", "MATCH_EVENT_PERIOD_REQUIRED");
  const periodIndex = PERIOD_INDEX[period];
  if (periodIndex === undefined || periodIndex > lastIndex) fail(422, "An event cannot be assigned to a future Match period.", "MATCH_EVENT_FUTURE_PERIOD");

  const elapsedSeconds = mockPeriodElapsedSeconds(match, period, nowMs);
  const base = mockPeriodBaseMinutes(match, period);
  const length = mockPeriodLengthMinutes(match, period);
  const nominalSeconds = length * 60;
  const boundary = base + length;
  const defaultMinute = elapsedSeconds <= nominalSeconds
    ? Math.max(base + 1, base + Math.floor(elapsedSeconds / 60))
    : boundary;
  const defaultAdded = elapsedSeconds > nominalSeconds ? Math.floor((elapsedSeconds - nominalSeconds) / 60) : 0;
  const minute = input.minute ?? existing?.minute ?? (isCompletedCorrection ? null : defaultMinute);
  const eventTimeChanged = Boolean(existing && (
    (input.period !== undefined && input.period !== existing.period)
    || (input.minute !== undefined && input.minute !== existing.minute)
  ));
  const addedMinutes = input.addedMinutes
    ?? (eventTimeChanged ? 0 : existing?.addedMinutes ?? (input.minute === undefined && !isCompletedCorrection ? defaultAdded : 0));
  if (minute == null) fail(422, "Enter an event minute when correcting a completed match.", "MATCH_EVENT_MINUTE_REQUIRED");
  if (!Number.isSafeInteger(minute) || minute <= base || minute > boundary) {
    fail(422, "Enter a valid cumulative match minute within the selected period.", "INVALID_MATCH_EVENT_TIME", { minute: "Minute is outside the selected period" });
  }
  if (addedMinutes == null || !Number.isSafeInteger(addedMinutes) || addedMinutes < 0 || (addedMinutes > 0 && minute !== boundary)) {
    fail(422, "Added minutes are valid only at the nominal end of a period.", "INVALID_MATCH_EVENT_ADDED_TIME", { addedMinutes: "Use added minutes only at the period boundary" });
  }
  const eventElapsed = addedMinutes > 0
    ? nominalSeconds + addedMinutes * 60
    : minute === base + 1 ? 0 : (minute - base) * 60;
  if (eventElapsed > elapsedSeconds) {
    fail(422, "The event time is later than the stored/current Match clock position.", "MATCH_EVENT_IN_FUTURE", { minute: "An event cannot be recorded ahead of the match clock" });
  }
  return { period, minute, addedMinutes };
}

export function stopMockMatchClock(match: MockSeasonMatch, fail: MockFail, nowDate = new Date()): MockSeasonMatch["clock"] {
  const period = mockTimedPeriodForPhase(match.phase);
  if (!period) fail(409, "The current Match phase does not run a clock.", "MATCH_CLOCK_PHASE_INVALID");
  if (!match.clock.isRunning) {
    if (match.clock.clockStartedAt) fail(409, "The stopped Match clock cannot retain a running segment timestamp.", "MATCH_CLOCK_INVALID");
    return match.clock;
  }
  if (!match.clock.clockStartedAt) fail(409, "The running Match clock has no server start timestamp.", "MATCH_CLOCK_INVALID");
  return {
    ...match.clock,
    isRunning: false,
    clockStartedAt: null,
    periodElapsedSecondsByPeriod: {
      ...match.clock.periodElapsedSecondsByPeriod,
      [CLOCK_KEY[period]]: mockPeriodElapsedSeconds(match, period, nowDate.getTime()),
    },
  };
}

export function startMockMatchClock(match: MockSeasonMatch, phase: MockSeasonMatch["phase"], fail: MockFail, nowDate = new Date()): MockSeasonMatch["clock"] {
  const period = mockTimedPeriodForPhase(phase);
  if (!period) fail(409, "The current Match phase does not run a clock.", "MATCH_CLOCK_PHASE_INVALID");
  if (match.clock.isRunning || match.clock.clockStartedAt) fail(409, "The Match clock is already running or has an active segment.", "MATCH_CLOCK_ALREADY_RUNNING");
  return { ...match.clock, isRunning: true, clockStartedAt: nowDate.toISOString() };
}

export function assertMockPhaseTransitionAllowed(
  match: MockSeasonMatch,
  action: MatchPhaseAction,
  homeScore: number,
  awayScore: number,
  fail: MockFail,
): void {
  if (match.status !== "live") fail(409, "Phase transitions are available only while the match is Live.", "MATCH_NOT_LIVE");
  const tied = homeScore === awayScore;
  const invalid = (message: string) => fail(409, message, "INVALID_MATCH_PHASE_TRANSITION");
  switch (action) {
    case "half_time": if (match.phase !== "first_half") invalid("Half Time can only follow the First Half."); return;
    case "start_second_half": if (match.phase !== "half_time") invalid("The Second Half can only start after Half Time."); return;
    case "regular_full_time": if (match.phase !== "second_half") invalid("Regular Full Time can only follow the Second Half."); return;
    case "start_extra_time":
      if (match.phase !== "regular_full_time") invalid("Extra Time can only start after Regular Full Time.");
      if (match.stage === "group") fail(409, "Group-stage matches cannot use Extra Time.", "GROUP_EXTRA_TIME");
      if (!tied) fail(409, "Extra Time is only available when regular-time score is tied.", "EXTRA_TIME_NOT_REQUIRED");
      if (!match.decidingRules.extraTime.isAllowed) fail(409, "Extra Time is disabled for this fixture.", "EXTRA_TIME_DISABLED");
      return;
    case "extra_time_half_time": if (match.phase !== "extra_time_first_half") invalid("Extra Time Half Time can only follow the first Extra Time half."); return;
    case "start_extra_time_second_half": if (match.phase !== "extra_time_half_time") invalid("The second Extra Time half can only start after its half-time break."); return;
    case "end_extra_time": if (match.phase !== "extra_time_second_half") invalid("Extra Time can only end after its second half."); return;
    case "start_penalty_shootout":
      if (match.phase !== "regular_full_time" && match.phase !== "extra_time_completed") invalid("A Penalty Shootout can only start after Regular Full Time or completed Extra Time.");
      if (match.stage === "group") fail(409, "Group-stage matches cannot use a Penalty Shootout.", "GROUP_PENALTY_SHOOTOUT");
      if (!tied) fail(409, "A Penalty Shootout is only available when the normal match score is tied.", "SHOOTOUT_NOT_REQUIRED");
      if (!match.decidingRules.penaltyShootout.isAllowed) fail(409, "Penalty Shootout is disabled for this fixture.", "SHOOTOUT_DISABLED");
      if (match.phase === "regular_full_time" && match.decidingRules.extraTime.isAllowed) fail(409, "Complete configured Extra Time before starting the Penalty Shootout.", "EXTRA_TIME_REQUIRED");
      return;
    case "complete_penalty_shootout":
      if (match.phase !== "penalty_shootout") invalid("A Penalty Shootout can only be completed while active.");
      if (!match.penaltyShootout) fail(409, "Record the shootout before completing it.", "SHOOTOUT_REQUIRED");
      return;
  }
}

export function getMockRegularFullTimeOutcome(match: MockSeasonMatch, homeScore: number, awayScore: number): "complete" | "extra_time" | "penalty_shootout" {
  if (homeScore !== awayScore || match.stage === "group") return "complete";
  if (match.decidingRules.extraTime.isAllowed) return "extra_time";
  if (match.decidingRules.penaltyShootout.isAllowed) return "penalty_shootout";
  return "complete";
}

export function getMockExtraTimeOutcome(match: MockSeasonMatch, homeScore: number, awayScore: number): "complete" | "penalty_shootout" {
  if (homeScore !== awayScore) return "complete";
  return match.decidingRules.penaltyShootout.isAllowed ? "penalty_shootout" : "complete";
}


export function getMockEventElapsedSeconds(
  match: MockSeasonMatch,
  event: MockEventTimingInput,
): number | null {
  if (!event.period || event.minute == null) return null;
  if (event.addedMinutes && event.addedMinutes > 0) {
    return mockPeriodLengthMinutes(match, event.period) * 60 + event.addedMinutes * 60;
  }
  const base = mockPeriodBaseMinutes(match, event.period);
  return event.minute === base + 1 ? 0 : (event.minute - base) * 60;
}

export function resolveMockClockCorrection(
  match: MockSeasonMatch,
  updates: Partial<MockSeasonMatch["clock"]["periodElapsedSecondsByPeriod"]>,
  fail: MockFail,
): MockSeasonMatch["clock"]["periodElapsedSecondsByPeriod"] {
  if (!match.actualStartedAt || match.clock.isRunning || match.clock.clockStartedAt) {
    fail(409, "Pause the clock before correcting elapsed Match time.", "MATCH_CLOCK_MUST_BE_STOPPED");
  }
  for (const value of Object.values(updates)) {
    if (!Number.isSafeInteger(value) || (value ?? -1) < 0) {
      fail(422, "Corrected elapsed seconds must be non-negative whole numbers.", "INVALID_MATCH_CLOCK_CORRECTION");
    }
  }
  const next = { ...match.clock.periodElapsedSecondsByPeriod, ...updates };
  const periodKey: Record<MatchTimedPeriod, keyof typeof next> = {
    first_half: "firstHalf",
    second_half: "secondHalf",
    extra_time_first_half: "extraTimeFirstHalf",
    extra_time_second_half: "extraTimeSecondHalf",
  };
  for (const event of [...match.goals, ...(match.cards ?? [])]) {
    const elapsed = getMockEventElapsedSeconds(match, event);
    if (elapsed !== null && event.period && elapsed > next[periodKey[event.period]]) {
      fail(409, "Clock correction would place an existing goal or card after the corrected clock. Correct that event explicitly first.", "MATCH_CLOCK_BEFORE_EXISTING_EVENT");
    }
  }
  return next;
}

export function assertMockPhaseCorrectionAllowed(
  match: MockSeasonMatch,
  phase: Exclude<MockSeasonMatch["phase"], null | "full_time">,
  homeScore: number,
  awayScore: number,
  fail: MockFail,
): void {
  if (match.status !== "live" || !match.actualStartedAt || match.clock.isRunning || match.clock.clockStartedAt) {
    fail(409, "Phase corrections require a started Live Match with its clock stopped.", "MATCH_PHASE_CORRECTION_NOT_ALLOWED");
  }
  const indexByPhase: Record<Exclude<MockSeasonMatch["phase"], null | "full_time">, number> = {
    first_half: 0,
    half_time: 0,
    second_half: 1,
    regular_full_time: 1,
    extra_time_first_half: 2,
    extra_time_half_time: 2,
    extra_time_second_half: 3,
    extra_time_completed: 3,
    penalty_shootout: match.clock.periodElapsedSecondsByPeriod.extraTimeFirstHalf > 0
      || match.clock.periodElapsedSecondsByPeriod.extraTimeSecondHalf > 0 ? 3 : 1,
    penalty_shootout_completed: match.clock.periodElapsedSecondsByPeriod.extraTimeFirstHalf > 0
      || match.clock.periodElapsedSecondsByPeriod.extraTimeSecondHalf > 0 ? 3 : 1,
  };
  if (!Object.hasOwn(indexByPhase, phase)) {
    fail(422, "Choose a valid Match phase.", "INVALID_MATCH_PHASE");
  }
  const targetIndex = indexByPhase[phase];
  const elapsed = Object.values(match.clock.periodElapsedSecondsByPeriod);
  if (elapsed.some((seconds, index) => index > targetIndex && seconds > 0)) {
    fail(409, "The corrected phase cannot precede already recorded elapsed time in a later period.", "MATCH_PHASE_BEFORE_CLOCK");
  }
  for (const event of [...match.goals, ...(match.cards ?? [])]) {
    if (event.period && PERIOD_INDEX[event.period] > targetIndex) {
      fail(409, "The corrected phase cannot precede existing Match events. Correct those events first.", "MATCH_PHASE_BEFORE_EVENT");
    }
  }
  if (phase.startsWith("extra_time_")) {
    if (match.stage === "group" || !match.decidingRules.extraTime.isAllowed) {
      fail(409, "Extra Time is not enabled for this fixture.", "EXTRA_TIME_DISABLED");
    }
  }
  if (phase.startsWith("penalty_shootout")) {
    if (match.stage === "group" || !match.decidingRules.penaltyShootout.isAllowed || homeScore !== awayScore) {
      fail(409, "Penalty Shootout is not valid for this fixture state.", "SHOOTOUT_NOT_ALLOWED");
    }
    if (match.decidingRules.extraTime.isAllowed && phase === "penalty_shootout"
      && match.phase !== "extra_time_completed" && match.phase !== "penalty_shootout" && match.phase !== "penalty_shootout_completed") {
      fail(409, "Complete the configured Extra Time before correcting the phase to Penalty Shootout.", "EXTRA_TIME_REQUIRED");
    }
    if (phase === "penalty_shootout_completed" && match.penaltyShootout?.status !== "completed") {
      fail(409, "A completed shootout record is required for this phase.", "SHOOTOUT_REQUIRED");
    }
  }
}
