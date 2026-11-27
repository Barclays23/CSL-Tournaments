import type { MatchTimedPeriod, SeasonMatch } from "@/types/seasonMatch.types";

export const MATCH_TIMED_PERIODS: readonly MatchTimedPeriod[] = [
  "first_half",
  "second_half",
  "extra_time_first_half",
  "extra_time_second_half",
];

const PERIOD_LABEL: Record<MatchTimedPeriod, string> = {
  first_half: "First Half",
  second_half: "Second Half",
  extra_time_first_half: "Extra Time · First Half",
  extra_time_second_half: "Extra Time · Second Half",
};

const CLOCK_KEY: Record<MatchTimedPeriod, keyof SeasonMatch["clock"]["periodElapsedSecondsByPeriod"]> = {
  first_half: "firstHalf",
  second_half: "secondHalf",
  extra_time_first_half: "extraTimeFirstHalf",
  extra_time_second_half: "extraTimeSecondHalf",
};

export function getPeriodLabel(period: MatchTimedPeriod): string {
  return PERIOD_LABEL[period];
}

export function getPeriodBaseMinutes(match: SeasonMatch, period: MatchTimedPeriod): number {
  const regularHalf = match.matchDurationMinutes / 2;
  const extraHalf = match.decidingRules.extraTime.durationMinutes / 2;
  switch (period) {
    case "first_half": return 0;
    case "second_half": return regularHalf;
    case "extra_time_first_half": return match.matchDurationMinutes;
    case "extra_time_second_half": return match.matchDurationMinutes + extraHalf;
  }
}

export function getPeriodLengthMinutes(match: SeasonMatch, period: MatchTimedPeriod): number {
  return period.startsWith("extra_time_")
    ? match.decidingRules.extraTime.durationMinutes / 2
    : match.matchDurationMinutes / 2;
}

export function getPeriodElapsedSeconds(match: SeasonMatch, period: MatchTimedPeriod, now = Date.now()): number {
  const stored = match.clock.periodElapsedSecondsByPeriod[CLOCK_KEY[period]] ?? 0;
  const runningPeriod: MatchTimedPeriod | null =
    match.phase === "first_half" ? "first_half"
      : match.phase === "second_half" ? "second_half"
        : match.phase === "extra_time_first_half" ? "extra_time_first_half"
          : match.phase === "extra_time_second_half" ? "extra_time_second_half"
            : null;
  if (!match.clock.isRunning || runningPeriod !== period || !match.clock.clockStartedAt) return stored;
  const startedAt = new Date(match.clock.clockStartedAt).getTime();
  if (!Number.isFinite(startedAt)) return stored;
  return stored + Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function getLastPlayedPeriodIndex(match: SeasonMatch): number {
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
          && ["extra_time_first_half", "extra_time_half_time", "extra_time_second_half", "extra_time_completed"].includes(
            String(entry.newValue.phase ?? ""),
          ))
        ? 3 : 1;
    default: return -1;
  }
}

export function getAvailableEventPeriods(match: SeasonMatch): MatchTimedPeriod[] {
  const lastIndex = getLastPlayedPeriodIndex(match);
  return MATCH_TIMED_PERIODS.filter((_, index) => index <= lastIndex);
}

export function getDefaultEventTiming(match: SeasonMatch, now = Date.now()): {
  period: MatchTimedPeriod | null;
  minute: number;
  addedMinutes: number;
} {
  const runningPeriod: MatchTimedPeriod | null =
    match.phase === "first_half" ? "first_half"
      : match.phase === "second_half" ? "second_half"
        : match.phase === "extra_time_first_half" ? "extra_time_first_half"
          : match.phase === "extra_time_second_half" ? "extra_time_second_half"
            : null;
  const available = getAvailableEventPeriods(match);
  const period = runningPeriod ?? available.at(-1) ?? null;
  if (!period) return { period: null, minute: 1, addedMinutes: 0 };
  const elapsedSeconds = getPeriodElapsedSeconds(match, period, now);
  const nominalSeconds = getPeriodLengthMinutes(match, period) * 60;
  const base = getPeriodBaseMinutes(match, period);
  if (elapsedSeconds > nominalSeconds) {
    return {
      period,
      minute: base + getPeriodLengthMinutes(match, period),
      addedMinutes: Math.floor((elapsedSeconds - nominalSeconds) / 60),
    };
  }
  return {
    period,
    minute: Math.max(base + 1, base + Math.floor(elapsedSeconds / 60)),
    addedMinutes: 0,
  };
}

export function formatMatchClock(match: SeasonMatch, now = Date.now()): string {
  const phase = match.phase;
  const period: MatchTimedPeriod | null =
    phase === "first_half" ? "first_half"
      : phase === "second_half" ? "second_half"
        : phase === "extra_time_first_half" ? "extra_time_first_half"
          : phase === "extra_time_second_half" ? "extra_time_second_half"
            : null;
  if (!period) {
    if (phase === "half_time") return "Half Time";
    if (phase === "regular_full_time") return "Full Time · Decision";
    if (phase === "extra_time_half_time") return "Extra Time Half Time";
    if (phase === "extra_time_completed") return "Extra Time · Decision";
    if (phase === "penalty_shootout") return "Penalty Shootout";
    if (phase === "penalty_shootout_completed") return "Shootout Complete";
    if (phase === "full_time") return "Full Time";
    return "Not started";
  }

  const elapsed = getPeriodElapsedSeconds(match, period, now);
  const nominal = getPeriodLengthMinutes(match, period) * 60;
  const base = getPeriodBaseMinutes(match, period);
  if (elapsed > nominal) {
    const extra = elapsed - nominal;
    const minutes = Math.floor(extra / 60);
    const seconds = extra % 60;
    return `${base + getPeriodLengthMinutes(match, period)}+${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  const cumulativeSeconds = base * 60 + elapsed;
  return `${String(Math.floor(cumulativeSeconds / 60)).padStart(2, "0")}:${String(cumulativeSeconds % 60).padStart(2, "0")}`;
}

export function formatMatchEventTime(
  period: MatchTimedPeriod | null | undefined,
  minute: number | null | undefined,
  addedMinutes: number | null | undefined,
): string {
  if (!period || minute == null) return "Time not recorded";
  const time = addedMinutes && addedMinutes > 0 ? `${minute}+${addedMinutes}'` : `${minute}'`;
  if (period === "extra_time_first_half") return `ET 1 · ${time}`;
  if (period === "extra_time_second_half") return `ET 2 · ${time}`;
  return time;
}

export function getMatchPhaseLabel(phase: SeasonMatch["phase"]): string {
  switch (phase) {
    case null: return "Not started";
    case "first_half": return "First Half";
    case "half_time": return "Half Time";
    case "second_half": return "Second Half";
    case "regular_full_time": return "Regular Full Time · Decision";
    case "extra_time_first_half": return "Extra Time · First Half";
    case "extra_time_half_time": return "Extra Time · Half Time";
    case "extra_time_second_half": return "Extra Time · Second Half";
    case "extra_time_completed": return "Extra Time · Decision";
    case "penalty_shootout": return "Penalty Shootout";
    case "penalty_shootout_completed": return "Penalty Shootout Complete";
    case "full_time": return "Full Time";
  }
}
