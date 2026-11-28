import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { ICONS, TONES, ToneIcon, fieldClass, type Tone } from "@/components/ui/Tones";
import type { MatchPhase, SeasonMatch } from "@/types/seasonMatch.types";
import { correctSeasonMatchActualKickoff, correctSeasonMatchClock, correctSeasonMatchPhase } from "@/services/seasonMatchService";

type CorrectablePhase = Exclude<MatchPhase, null | "full_time">;
type TabKey = "kickoff" | "clock" | "phase";

const PHASE_LABEL: Record<CorrectablePhase, string> = {
  first_half: "First Half", half_time: "Half Time", second_half: "Second Half",
  regular_full_time: "Regular Full Time", extra_time_first_half: "Extra Time · First Half",
  extra_time_half_time: "Extra Time · Half Time", extra_time_second_half: "Extra Time · Second Half",
  extra_time_completed: "Extra Time Completed", penalty_shootout: "Penalty Shootout",
  penalty_shootout_completed: "Penalty Shootout Completed",
};
const TAB_META: Record<TabKey, { label: string; hint: string; tone: Tone; icon: string }> = {
  kickoff: { label: "Kickoff", hint: "Fix the recorded start time", tone: "info", icon: ICONS.calendar },
  clock: { label: "Clock", hint: "Fix elapsed seconds per period", tone: "gold", icon: ICONS.clock },
  phase: { label: "Phase", hint: "Move the match to the right phase", tone: "accent", icon: ICONS.flag },
};
const CLOCK_FIELDS = [
  ["firstHalf", "First Half"], ["secondHalf", "Second Half"],
  ["extraTimeFirstHalf", "Extra Time · 1st Half"], ["extraTimeSecondHalf", "Extra Time · 2nd Half"],
] as const;

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
}
function mmss(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "--:--";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function getScore(match: SeasonMatch) {
  const home = typeof match.homeSeasonTeamRef === "string" ? match.homeSeasonTeamRef : match.homeSeasonTeamRef._id;
  const away = typeof match.awaySeasonTeamRef === "string" ? match.awaySeasonTeamRef : match.awaySeasonTeamRef._id;
  return {
    home: match.goals.filter((goal) => (typeof goal.scoringSeasonTeamRef === "string" ? goal.scoringSeasonTeamRef : goal.scoringSeasonTeamRef._id) === home).length,
    away: match.goals.filter((goal) => (typeof goal.scoringSeasonTeamRef === "string" ? goal.scoringSeasonTeamRef : goal.scoringSeasonTeamRef._id) === away).length,
  };
}
function correctionPhases(match: SeasonMatch): CorrectablePhase[] {
  const options: CorrectablePhase[] = ["first_half", "half_time", "second_half", "regular_full_time"];
  if (match.stage !== "group" && match.decidingRules.extraTime.isAllowed) options.push("extra_time_first_half", "extra_time_half_time", "extra_time_second_half", "extra_time_completed");
  const result = getScore(match);
  if (match.stage !== "group" && match.decidingRules.penaltyShootout.isAllowed && result.home === result.away) {
    options.push("penalty_shootout");
    if (match.penaltyShootout?.status === "completed") options.push("penalty_shootout_completed");
  }
  return options;
}

export function MatchEngineCorrectionSection({ seasonId, match, isAdmin, onMatchUpdated }: {
  seasonId: string; match: SeasonMatch; isAdmin: boolean; onMatchUpdated: (match: SeasonMatch) => void;
}) {
  const [actualKickoff, setActualKickoff] = useState(() => toDateTimeLocal(match.actualStartedAt));
  const [kickoffReason, setKickoffReason] = useState("");
  const [clockValues, setClockValues] = useState({ ...match.clock.periodElapsedSecondsByPeriod });
  const [clockReason, setClockReason] = useState("");
  const [phase, setPhase] = useState<CorrectablePhase>(() => match.phase && match.phase !== "full_time" ? match.phase : "first_half");
  const [phaseReason, setPhaseReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("kickoff");
  const candidates = useMemo(() => correctionPhases(match), [match]);
  if (!isAdmin || !match.actualStartedAt) return null;
  const clockStopped = !match.clock.isRunning && !match.clock.clockStartedAt;
  const invalidClock = Object.values(clockValues).some((value) => !Number.isSafeInteger(value) || value < 0);
  const clockChanged = (Object.keys(clockValues) as Array<keyof typeof clockValues>).some((key) => clockValues[key] !== match.clock.periodElapsedSecondsByPeriod[key]);
  const publish = (updated: SeasonMatch, message: string) => { onMatchUpdated(updated); toast.success(message); };

  const submitKickoff = async () => {
    if (!actualKickoff || kickoffReason.trim().length < 3) return;
    const timestamp = new Date(actualKickoff);
    if (!Number.isFinite(timestamp.getTime()) || timestamp.getTime() > Date.now()) { toast.error("Actual kickoff must be a valid timestamp in the past."); return; }
    setSaving(true);
    try {
      const response = await correctSeasonMatchActualKickoff(seasonId, match._id, { actualStartedAt: timestamp.toISOString(), reason: kickoffReason.trim() });
      publish(response.data, "Actual kickoff corrected"); setKickoffReason("");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to correct actual kickoff"); }
    finally { setSaving(false); }
  };
  const submitClock = async () => {
    if (!clockChanged || invalidClock || clockReason.trim().length < 3 || !clockStopped) return;
    setSaving(true);
    try {
      const response = await correctSeasonMatchClock(seasonId, match._id, { periodElapsedSecondsByPeriod: clockValues, reason: clockReason.trim() });
      publish(response.data, "Match clock corrected"); setClockReason("");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to correct Match clock"); }
    finally { setSaving(false); }
  };
  const submitPhase = async () => {
    if (!candidates.includes(phase) || phaseReason.trim().length < 3 || !clockStopped) return;
    setSaving(true);
    try {
      const response = await correctSeasonMatchPhase(seasonId, match._id, { phase, reason: phaseReason.trim() });
      publish(response.data, "Match phase corrected"); setPhaseReason("");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to correct Match phase"); }
    finally { setSaving(false); }
  };

  const tCard = TONES.primary;
  const tabs: TabKey[] = match.status === "live" ? ["kickoff", "clock", "phase"] : ["kickoff", "clock"];
  const activeTab: TabKey = tabs.includes(tab) ? tab : "kickoff";
  const t = TONES[TAB_META[activeTab].tone];
  const dirty: Record<TabKey, boolean> = {
    kickoff: kickoffReason.trim().length > 0,
    clock: clockChanged,
    phase: phase !== (match.phase && match.phase !== "full_time" ? match.phase : "first_half"),
  };
  const currentPhase = match.phase && match.phase !== "full_time" ? PHASE_LABEL[match.phase as CorrectablePhase] : "Full time";

  const reasonField = (value: string, onChange: (v: string) => void, placeholder: string, disabled: boolean) => (
    <label className="grid min-w-0 flex-1 gap-1 text-xs">Correction reason
      <Input className={t.input} value={value} maxLength={1000} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );

  return <GlassCard className={`mt-4 overflow-hidden p-0 ${tCard.glass}`}>
    {/* Header: always visible, toggles the body */}
    <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
      className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left sm:p-5">
      <span className="flex min-w-0 items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tCard.chip}`}><ToneIcon d={ICONS.wrench} /></span>
        <span className="min-w-0">
          <span className="block font-display text-lg text-fg">Match Engine Corrections</span>
          <span className="block text-xs text-muted">Admin-only, audited. Clock corrections never move scheduled kickoff or event minutes.</span>
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES.accent.pill}`}>{currentPhase}</span>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${clockStopped ? TONES.gold.pill : TONES.success.pill}`}>{clockStopped ? "Clock stopped" : "Clock running"}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full border transition-transform ${tCard.iconBtn} ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </span>
    </button>

    {open ? <div className={`border-t p-4 sm:p-5 ${tCard.divider}`}>
      {/* Segmented tabs */}
      <div role="tablist" aria-label="Correction type" className={`grid gap-2 ${tabs.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {tabs.map((key) => {
          const meta = TAB_META[key];
          const tt = TONES[meta.tone];
          const selected = key === activeTab;
          return <button key={key} type="button" role="tab" aria-selected={selected} onClick={() => setTab(key)}
            className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition backdrop-blur-md ${selected ? `${tt.cardOn} ring-1 ring-line` : tt.cardOff}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? tt.chipOn : tt.chip}`}><ToneIcon d={meta.icon} /></span>
            <span className="min-w-0">
              <span className={`block text-sm font-semibold ${selected ? tt.text : "text-fg"}`}>{meta.label}</span>
              <span className="block truncate text-xs text-muted">{meta.hint}</span>
            </span>
            {dirty[key] ? <span className={`absolute right-2.5 top-2.5 h-2 w-2 rounded-full ${tt.dot}`} title="Unsaved changes" /> : null}
          </button>;
        })}
      </div>

      {/* Active panel */}
      <div role="tabpanel" className={`mt-4 grid gap-4 rounded-2xl border p-4 backdrop-blur-md ${t.section} ${t.labels}`}>
        {activeTab === "kickoff" ? <>
          <p className="text-xs text-muted">Scheduled kickoff stays <span className="font-semibold text-fg">{new Date(match.kickoffAt).toLocaleString()}</span> and is not changed.</p>
          <label className="grid gap-1 text-xs sm:max-w-xs">Recorded actual kickoff
            <Input className={t.input} type="datetime-local" value={actualKickoff} disabled={saving} onChange={(event) => setActualKickoff(event.target.value)} />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {reasonField(kickoffReason, setKickoffReason, "Why is the recorded kickoff wrong?", saving)}
            <Button size="sm" disabled={saving || !actualKickoff || kickoffReason.trim().length < 3} onClick={() => void submitKickoff()}>{saving ? "Saving…" : "Correct kickoff"}</Button>
          </div>
        </> : null}

        {activeTab === "clock" ? <>
          {!clockStopped ? <p className={`rounded-lg border px-3 py-1.5 text-xs ${t.note}`}>Pause the Match clock before correcting elapsed time.</p> : null}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {CLOCK_FIELDS.map(([key, label]) => {
              const original = match.clock.periodElapsedSecondsByPeriod[key];
              const changed = clockValues[key] !== original;
              return <label key={key} className={`grid gap-1 rounded-xl border p-3 text-xs transition ${changed ? t.cardOn : t.cardOff}`}>
                <span>{label}</span>
                <span className="font-display text-xl tabular-nums text-fg">{mmss(clockValues[key])}</span>
                <Input className={t.input} type="number" min={0} step={1} value={clockValues[key]} disabled={saving || !clockStopped}
                  onChange={(event) => setClockValues((current) => ({ ...current, [key]: Number(event.target.value) }))} />
                <span className="font-normal text-muted">{changed ? `Was ${mmss(original)} (${original}s)` : "seconds · unchanged"}</span>
              </label>;
            })}
          </div>
          {invalidClock ? <p className="text-xs text-danger">Elapsed-time values must be non-negative whole numbers of seconds.</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {reasonField(clockReason, setClockReason, "Why is the stored elapsed time wrong?", saving || !clockStopped)}
            <Button size="sm" disabled={saving || !clockStopped || invalidClock || !clockChanged || clockReason.trim().length < 3} onClick={() => void submitClock()}>{saving ? "Saving…" : "Correct clock"}</Button>
          </div>
        </> : null}

        {activeTab === "phase" ? <>
          <p className="text-xs text-muted">Only phases compatible with the fixture rules are offered. The backend checks existing elapsed periods and events before saving.</p>
          {!clockStopped ? <p className={`rounded-lg border px-3 py-1.5 text-xs ${t.note}`}>Pause the Match clock before correcting the phase.</p> : null}
          <label className="grid gap-1 text-xs sm:max-w-xs">Corrected phase
            <select className={fieldClass("accent")} value={phase} disabled={saving || !clockStopped} onChange={(event) => setPhase(event.target.value as CorrectablePhase)}>
              {candidates.map((candidate) => <option key={candidate} value={candidate}>{PHASE_LABEL[candidate]}</option>)}
            </select>
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {reasonField(phaseReason, setPhaseReason, "Why is the current phase incorrect?", saving || !clockStopped)}
            <Button size="sm" disabled={saving || !clockStopped || !candidates.includes(phase) || phaseReason.trim().length < 3} onClick={() => void submitPhase()}>{saving ? "Saving…" : "Correct phase"}</Button>
          </div>
        </> : null}
      </div>
    </div> : null}
  </GlassCard>;
}