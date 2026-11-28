import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import type { MatchPhase, SeasonMatch } from "@/types/seasonMatch.types";
import { correctSeasonMatchActualKickoff, correctSeasonMatchClock, correctSeasonMatchPhase } from "@/services/seasonMatchService";

type CorrectablePhase = Exclude<MatchPhase, null | "full_time">;
const PHASE_LABEL: Record<CorrectablePhase, string> = {
  first_half: "First Half", half_time: "Half Time", second_half: "Second Half",
  regular_full_time: "Regular Full Time", extra_time_first_half: "Extra Time · First Half",
  extra_time_half_time: "Extra Time · Half Time", extra_time_second_half: "Extra Time · Second Half",
  extra_time_completed: "Extra Time Completed", penalty_shootout: "Penalty Shootout",
  penalty_shootout_completed: "Penalty Shootout Completed",
};
function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
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

  return <GlassCard className="mt-4 p-4 sm:p-5">
    <h2 className="font-display text-lg text-fg">Match Engine Corrections</h2>
    <p className="mt-1 text-sm text-muted">Administrator-only audited corrections. Each operation uses its dedicated backend validation; scheduled kickoff and event minutes are not changed by clock corrections.</p>
    <section className="mt-4 grid gap-3 border-b border-line pb-4">
      <div><h3 className="text-sm font-semibold text-fg">Actual Kickoff Correction</h3>
        <p className="mt-0.5 text-xs text-muted">Scheduled kickoff remains {new Date(match.kickoffAt).toLocaleString()} and is not changed.</p></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-xs font-semibold text-muted">Recorded actual kickoff
          <Input type="datetime-local" value={actualKickoff} disabled={saving} onChange={(event) => setActualKickoff(event.target.value)} /></label>
        <label className="grid gap-1 text-xs font-semibold text-muted">Correction reason
          <Input value={kickoffReason} maxLength={1000} disabled={saving} onChange={(event) => setKickoffReason(event.target.value)} placeholder="Why is the recorded kickoff wrong?" /></label>
        <Button size="sm" disabled={saving || !actualKickoff || kickoffReason.trim().length < 3} onClick={() => void submitKickoff()}>Correct kickoff</Button>
      </div>
    </section>
    <section className="mt-4 grid gap-3 border-b border-line pb-4">
      <div><h3 className="text-sm font-semibold text-fg">Match Clock Correction</h3>
        <p className="mt-0.5 text-xs text-muted">Correct stored elapsed seconds. Existing event times are never moved automatically; the backend rejects a clock value that would place an event in the future.</p></div>
      {!clockStopped ? <p className="text-xs text-warning">Pause the Match clock before correcting elapsed time.</p> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ["firstHalf", "First Half"], ["secondHalf", "Second Half"],
          ["extraTimeFirstHalf", "Extra Time · First Half"], ["extraTimeSecondHalf", "Extra Time · Second Half"],
        ] as const).map(([key, label]) => <label key={key} className="grid gap-1 text-xs font-semibold text-muted">{label} (seconds)
          <Input type="number" min={0} step={1} value={clockValues[key]} disabled={saving || !clockStopped}
            onChange={(event) => setClockValues((current) => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}
      </div>
      {invalidClock ? <p className="text-xs text-danger">Elapsed-time values must be non-negative whole numbers of seconds.</p> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="grid gap-1 text-xs font-semibold text-muted">Correction reason
          <Input value={clockReason} maxLength={1000} disabled={saving || !clockStopped} onChange={(event) => setClockReason(event.target.value)} placeholder="Why is the stored elapsed time wrong?" /></label>
        <Button size="sm" disabled={saving || !clockStopped || invalidClock || !clockChanged || clockReason.trim().length < 3} onClick={() => void submitClock()}>Correct clock</Button>
      </div>
    </section>
    <section className="mt-4 grid gap-3">
      <div><h3 className="text-sm font-semibold text-fg">Match Phase Correction</h3>
        <p className="mt-0.5 text-xs text-muted">Only phase choices compatible with the fixture rules are offered. The backend validates existing elapsed periods and events before saving.</p></div>
      {!clockStopped ? <p className="text-xs text-warning">Pause the Match clock before correcting the phase.</p> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-xs font-semibold text-muted">Corrected phase
          <select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg" value={phase} disabled={saving || !clockStopped} onChange={(event) => setPhase(event.target.value as CorrectablePhase)}>
            {candidates.map((candidate) => <option key={candidate} value={candidate}>{PHASE_LABEL[candidate]}</option>)}
          </select></label>
        <label className="grid gap-1 text-xs font-semibold text-muted">Correction reason
          <Input value={phaseReason} maxLength={1000} disabled={saving || !clockStopped} onChange={(event) => setPhaseReason(event.target.value)} placeholder="Why is the current phase incorrect?" /></label>
        <Button size="sm" disabled={saving || !clockStopped || !candidates.includes(phase) || phaseReason.trim().length < 3} onClick={() => void submitPhase()}>Correct phase</Button>
      </div>
    </section>
  </GlassCard>;
}
