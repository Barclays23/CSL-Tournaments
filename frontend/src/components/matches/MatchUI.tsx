import type { ReactNode } from "react";
import type { MatchTimedPeriod } from "@/types/seasonMatch.types";
import { formatMatchEventTime, getPeriodLabel } from "@/utils/matchTiming";

/** Shared native-control styling, built only from theme tokens (light + dark safe). */
export const fieldClass =
  "w-full rounded-control border border-line bg-surface px-3 py-2.5 text-sm font-normal text-fg placeholder:text-faint transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50";

export const panelClass = "rounded-2xl border border-line bg-surface/40 p-4";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-1.5 text-xs font-semibold text-muted ${className}`}>
      <span>{label}</span>
      {children}
      {hint ? <span className="font-normal text-faint">{hint}</span> : null}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  disabled = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid gap-1 rounded-xl border border-line bg-surface/60 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const on = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`min-w-0 truncate rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
              on
                ? "bg-accent text-accent-fg shadow-sm"
                : "text-muted hover:bg-glass-strong hover:text-fg"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  aside,
}: {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-lg text-fg">{title}</h2>
        {description ? <p className="mt-1 max-w-prose text-sm text-muted">{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}

export function DrawerFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-1 flex gap-2 border-t border-line bg-glass-strong px-1 pb-1 pt-4 backdrop-blur-md">
      {children}
    </div>
  );
}

export function EventTimeSection({
  clockPosition,
  period,
  periodOptions,
  onPeriodChange,
  minute,
  onMinuteChange,
  addedMinutes,
  onAddedMinutesChange,
  stoppageTimeAllowed,
  timeIsAhead,
  error,
  help,
}: {
  clockPosition: string;
  period: MatchTimedPeriod | null;
  periodOptions: MatchTimedPeriod[];
  onPeriodChange: (period: MatchTimedPeriod) => void;
  minute: number;
  onMinuteChange: (minute: number) => void;
  addedMinutes: number;
  onAddedMinutesChange: (minutes: number) => void;
  stoppageTimeAllowed: boolean;
  timeIsAhead: boolean;
  error?: string | null;
  help: string;
}) {
  return (
    <section className={panelClass}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">Event time</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-glass px-2.5 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          Clock <span className="tabular font-semibold text-fg">{clockPosition}</span>
        </span>
      </div>

      <div className="mt-3 grid gap-3">
        <Field label="Match period">
          <select
            className={fieldClass}
            required
            value={period ?? ""}
            onChange={(event) => onPeriodChange(event.target.value as MatchTimedPeriod)}
          >
            <option value="" disabled>
              Select a completed period
            </option>
            {periodOptions.map((value) => (
              <option key={value} value={value}>
                {getPeriodLabel(value)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Match minute">
            <input
              className={fieldClass}
              type="number"
              min={1}
              step={1}
              required
              value={minute}
              onChange={(event) => onMinuteChange(Number(event.target.value))}
            />
          </Field>
          <Field label="Added minutes">
            <input
              className={fieldClass}
              type="number"
              min={0}
              step={1}
              value={addedMinutes}
              disabled={!stoppageTimeAllowed}
              onChange={(event) => onAddedMinutesChange(Number(event.target.value))}
            />
          </Field>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">{help}</p>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-glass px-3 py-2.5">
        <span className="text-xs text-muted">Shown on timeline as</span>
        <span className="tabular font-display text-lg text-fg">
          {formatMatchEventTime(period, minute, addedMinutes)}
        </span>
      </div>

      {timeIsAhead ? (
        <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
          This event time is later than the current or stored Match clock position, or belongs to an unavailable period.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </section>
  );
}