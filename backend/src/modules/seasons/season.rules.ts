export type SeasonLifecycleState = "draft" | "upcoming" | "active" | "completed" | "archived";

export interface SeasonDateWindow {
  startDate: Date | null;
  endDate: Date | null;
  timeZone: string;
}

export function normalizeSeasonName(value: string): string {
  return value.trim().replace(/\\s+/g, " ").toLocaleLowerCase("en");
}

export function isAllowedSeasonTransition(current: SeasonLifecycleState, next: SeasonLifecycleState): boolean {
  return (current === "draft" && next === "upcoming")
    || (current === "upcoming" && (next === "draft" || next === "active"))
    || (current === "active" && next === "completed")
    || (current === "completed" && next === "archived");
}

export function seasonCalendarDate(value: Date, timeZone: string): string {
  if (Number.isNaN(value.getTime())) throw new RangeError("A valid date is required");
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export function isKickoffWithinSeasonDateWindow(kickoffAt: Date, window: SeasonDateWindow): boolean {
  const day = seasonCalendarDate(kickoffAt, window.timeZone);
  const start = window.startDate ? window.startDate.toISOString().slice(0, 10) : null;
  const end = window.endDate ? window.endDate.toISOString().slice(0, 10) : null;
  return (!start || day >= start) && (!end || day <= end);
}
