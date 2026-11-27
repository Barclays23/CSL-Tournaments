import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import {
  changeSeasonMatchStatus,
  completeSeasonMatch,
  pauseSeasonMatchClock,
  rescheduleSeasonMatch,
  resumeSeasonMatchClock,
  startSeasonMatch,
  transitionSeasonMatchPhase,
} from "@/services/seasonMatchService";
import type { MatchPhaseAction, SeasonMatch } from "@/types/seasonMatch.types";
import { formatDate, formatTime, fromDateTimeInput } from "@/utils/formatDate";
import { formatMatchClock, getMatchPhaseLabel } from "@/utils/matchTiming";
import { refId } from "@/utils/refs";

type ModalAction = "postpone" | "cancel" | "abandon" | "reschedule";

const PHASE_ACTION: Partial<Record<NonNullable<SeasonMatch["phase"]>, MatchPhaseAction>> = {
  first_half: "half_time",
  half_time: "start_second_half",
  second_half: "regular_full_time",
  extra_time_first_half: "extra_time_half_time",
  extra_time_half_time: "start_extra_time_second_half",
  extra_time_second_half: "end_extra_time",
};

const PHASE_ACTION_LABEL: Record<MatchPhaseAction, string> = {
  half_time: "Half Time",
  start_second_half: "Start Second Half",
  regular_full_time: "Regular Full Time",
  start_extra_time: "Start Extra Time",
  extra_time_half_time: "Extra Time Half Time",
  start_extra_time_second_half: "Start Extra Time Second Half",
  end_extra_time: "End Extra Time",
  start_penalty_shootout: "Start Penalty Shootout",
  complete_penalty_shootout: "Complete Penalty Shootout",
};

function statusLabel(status: SeasonMatch["status"]) {
  return status === "scheduled" ? "Scheduled" : status === "live" ? "Live" : status === "completed" ? "Completed" : status === "postponed" ? "Postponed" : status === "cancelled" ? "Cancelled" : "Abandoned";
}

function isTimedPhase(phase: SeasonMatch["phase"]): boolean {
  return phase === "first_half" || phase === "second_half" || phase === "extra_time_first_half" || phase === "extra_time_second_half";
}

function scoreOf(match: SeasonMatch) {
  const home = refId(match.homeSeasonTeamRef);
  const away = refId(match.awaySeasonTeamRef);
  return {
    home: match.goals.filter((goal) => refId(goal.scoringSeasonTeamRef) === home).length,
    away: match.goals.filter((goal) => refId(goal.scoringSeasonTeamRef) === away).length,
  };
}

export function MatchStatusManager({
  seasonId,
  match,
  isAdmin,
  onMatchUpdated,
}: {
  seasonId: string;
  match: SeasonMatch;
  isAdmin: boolean;
  onMatchUpdated: (updatedMatch: SeasonMatch) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalAction | null>(null);
  const [reason, setReason] = useState("");
  const [newKickoff, setNewKickoff] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [phaseError, setPhaseError] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const score = useMemo(() => scoreOf(match), [match]);
  const tied = score.home === score.away;
  const timedPhase = isTimedPhase(match.phase);
  const canManage = isAdmin && !["completed", "cancelled", "abandoned"].includes(match.status);

  const apply = (updated: SeasonMatch, message: string) => {
    onMatchUpdated(updated);
    toast.success(message);
    setPhaseError("");
  };

  const runPhase = async (action: MatchPhaseAction) => {
    setSaving(true);
    setPhaseError("");
    try {
      const response = await transitionSeasonMatchPhase(seasonId, match._id, action);
      apply(response.data, `${PHASE_ACTION_LABEL[action]} confirmed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to change the Match phase.";
      setPhaseError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const runSimple = async (action: "start" | "pause" | "resume" | "complete" | "resume_postponed") => {
    setSaving(true);
    setPhaseError("");
    try {
      const response = action === "start"
        ? await startSeasonMatch(seasonId, match._id)
        : action === "pause"
          ? await pauseSeasonMatchClock(seasonId, match._id)
          : action === "resume"
            ? await resumeSeasonMatchClock(seasonId, match._id)
            : action === "resume_postponed"
              ? await changeSeasonMatchStatus(seasonId, match._id, { action: "resume" })
              : await completeSeasonMatch(seasonId, match._id);
      const labels = { start: "Match started", pause: "Clock paused", resume: "Clock resumed", complete: "Match completed", resume_postponed: "Postponed Match resumed" };
      apply(response.data, labels[action]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update the Match.";
      setPhaseError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const openModal = (action: ModalAction) => {
    setActiveModal(action);
    setReason("");
    setNewKickoff("");
    setSubmitError("");
  };

  const submitModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeModal) return;
    const normalizedReason = reason.trim();
    if (activeModal !== "reschedule" && normalizedReason.length < 3) {
      setSubmitError("A reason with at least 3 characters is required.");
      return;
    }
    if (activeModal === "reschedule" && !newKickoff) {
      setSubmitError("Choose the new date and kick-off time.");
      return;
    }
    setSaving(true);
    setSubmitError("");
    try {
      const response = activeModal === "reschedule"
        ? await rescheduleSeasonMatch(seasonId, match._id, { kickoffAt: fromDateTimeInput(newKickoff) })
        : await changeSeasonMatchStatus(seasonId, match._id, { action: activeModal, reason: normalizedReason });
      apply(response.data, activeModal === "reschedule" ? "Match rescheduled" : `Match ${activeModal}ed`);
      setActiveModal(null);
      setReason("");
      setNewKickoff("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update Match status.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const primaryPhaseAction = PHASE_ACTION[match.phase ?? "full_time"];
  const regularOutcome = !tied
    ? "complete"
    : match.stage === "group"
      ? "complete"
      : match.decidingRules.extraTime.isAllowed
        ? "extra_time"
        : match.decidingRules.penaltyShootout.isAllowed
          ? "penalty_shootout"
          : "complete";
  const extraTimeOutcome = !tied ? "complete" : match.decidingRules.penaltyShootout.isAllowed ? "penalty_shootout" : "complete";
  const canCompleteShootout = Boolean(match.penaltyShootout
    && match.penaltyShootout.status === "pending"
    && match.penaltyShootout.homeTeamScore !== match.penaltyShootout.awayTeamScore);
  const phaseAction = match.phase === "regular_full_time"
    ? regularOutcome === "extra_time" ? "start_extra_time"
      : regularOutcome === "penalty_shootout" ? "start_penalty_shootout"
        : null
    : match.phase === "extra_time_completed"
      ? extraTimeOutcome === "penalty_shootout" ? "start_penalty_shootout" : null
      : match.phase === "penalty_shootout"
        ? canCompleteShootout ? "complete_penalty_shootout" : null
        : primaryPhaseAction;

  const canComplete = match.phase === "regular_full_time"
    ? regularOutcome === "complete"
    : match.phase === "extra_time_completed"
      ? extraTimeOutcome === "complete"
      : match.phase === "penalty_shootout_completed";
  const canPostpone = match.status === "scheduled" || (match.status === "live" && !match.clock.isRunning && !match.clock.clockStartedAt);
  const canCancel = (match.status === "scheduled" || match.status === "postponed") && !match.actualStartedAt;
  const canAbandon = (match.status === "live" || match.status === "postponed") && Boolean(match.actualStartedAt);
  const canReschedule = match.status === "postponed" && !match.actualStartedAt;
  const canResumePostponed = match.status === "postponed" && Boolean(match.actualStartedAt);

  return (
    <>
      <GlassCard className="mt-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg text-fg">Match status & clock</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${match.status === "live" ? "bg-success/15 text-success" : match.status === "postponed" ? "bg-warning/15 text-warning" : "bg-surface text-muted"}`}>
                {statusLabel(match.status)}
              </span>
              {match.status === "live" ? <span className="rounded-full border border-line px-2 py-1 text-xs text-muted">{match.clock.isRunning ? "Clock running" : "Clock paused"}</span> : null}
            </div>
            <p className="mt-1 text-sm text-muted">Phase · {getMatchPhaseLabel(match.phase)}</p>
            {match.actualStartedAt ? <p className="mt-1 text-xs text-faint">Actual kickoff · {formatDate(match.actualStartedAt)} · {formatTime(match.actualStartedAt)}</p> : null}
          </div>
          {match.status === "live" ? (
            <div className="min-w-36 rounded-xl border border-line bg-surface/60 px-4 py-3 text-center">
              <p className="font-display text-3xl tabular-nums text-fg" aria-live="off">{formatMatchClock(match, now)}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{match.clock.isRunning ? "Live clock" : "Paused clock"}</p>
            </div>
          ) : null}
        </div>

        {match.status === "live" ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {timedPhase && match.clock.isRunning ? <Button size="sm" variant="surface" disabled={!canManage || saving} onClick={() => void runSimple("pause")}>Pause</Button> : null}
            {timedPhase && !match.clock.isRunning ? <Button size="sm" variant="surface" disabled={!canManage || saving} onClick={() => void runSimple("resume")}>Resume clock</Button> : null}
            {phaseAction ? <Button size="sm" variant="accent" disabled={!canManage || saving} onClick={() => void runPhase(phaseAction)}>{PHASE_ACTION_LABEL[phaseAction]}</Button> : null}
            {canComplete ? <Button size="sm" disabled={!canManage || saving} onClick={() => void runSimple("complete")}>Complete Match</Button> : null}
          </div>
        ) : null}

        {match.status === "scheduled" && canManage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" disabled={saving} onClick={() => void runSimple("start")}>Start Match</Button>
            <Button size="sm" variant="surface" disabled={saving} onClick={() => openModal("postpone")}>Postpone</Button>
            <Button size="sm" variant="danger" disabled={saving} onClick={() => openModal("cancel")}>Cancel</Button>
          </div>
        ) : null}

        {match.status === "live" && canManage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {canPostpone ? <Button size="sm" variant="surface" disabled={saving} onClick={() => openModal("postpone")}>Postpone</Button> : null}
            {canAbandon ? <Button size="sm" variant="danger" disabled={saving} onClick={() => openModal("abandon")}>Abandon</Button> : null}
            {!canPostpone ? <p className="self-center text-xs text-muted">Pause the clock before postponing this Match.</p> : null}
          </div>
        ) : null}

        {match.status === "postponed" && canManage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {canResumePostponed ? <Button size="sm" disabled={saving} onClick={() => void runSimple("resume_postponed")}>Resume same Match</Button> : null}
            {canReschedule ? <Button size="sm" variant="surface" disabled={saving} onClick={() => openModal("reschedule")}>Reschedule</Button> : null}
            {canCancel ? <Button size="sm" variant="danger" disabled={saving} onClick={() => openModal("cancel")}>Cancel</Button> : null}
            {canAbandon ? <Button size="sm" variant="danger" disabled={saving} onClick={() => openModal("abandon")}>Abandon</Button> : null}
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-line bg-surface/40 p-3 text-xs leading-relaxed text-muted">
          <p className="font-semibold text-fg">Administrator guidance</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>Complete only after all required phases and deciding stages have been resolved.</li>
            <li>Postpone when the same Match will resume later or be rescheduled. A running clock must be paused first.</li>
            <li>Abandon a started Match that will not resume.</li>
            <li>Cancel only before the Match starts.</li>
            <li>Pause does not change Match status or phase. Paused time is excluded when the clock resumes.</li>
          </ul>
        </div>
        {phaseError ? <p className="mt-3 text-sm text-danger" role="alert">{phaseError}</p> : null}
        {match.status === "completed" ? <p className="mt-3 text-sm text-muted">All match phases are complete. The result is read-only except through the audited correction workflow.</p> : null}
        {match.status === "abandoned" || match.status === "cancelled" ? <p className="mt-3 text-sm text-muted">This Match is terminal and cannot be reopened through normal controls.</p> : null}
      </GlassCard>

      <Modal
        open={activeModal !== null}
        title={activeModal === "reschedule" ? "Reschedule Match" : activeModal ? `${activeModal[0].toUpperCase()}${activeModal.slice(1)} Match` : "Match action"}
        description={activeModal === "reschedule" ? "Only a fixture postponed before kickoff can receive a new scheduled kickoff." : "A reason is required and will be retained in the Match history."}
        onClose={() => { if (!saving) { setActiveModal(null); setSubmitError(""); } }}
      >
        {activeModal ? (
          <form className="grid gap-4" onSubmit={(event) => void submitModal(event)}>
            {activeModal === "reschedule" ? (
              <label className="grid gap-1.5 text-sm font-semibold text-fg">
                New kickoff
                <Input type="datetime-local" required value={newKickoff} onChange={(event) => setNewKickoff(event.target.value)} />
              </label>
            ) : (
              <label className="grid gap-1.5 text-sm font-semibold text-fg">
                Reason
                <Textarea required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={`Why is this Match being ${activeModal}?`} />
              </label>
            )}
            {submitError ? <p className="text-sm text-danger" role="alert">{submitError}</p> : null}
            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button type="button" variant="surface" disabled={saving} onClick={() => setActiveModal(null)}>Back</Button>
              <Button type="submit" variant={activeModal === "cancel" || activeModal === "abandon" ? "danger" : "primary"} disabled={saving || (activeModal === "reschedule" ? !newKickoff : reason.trim().length < 3)}>{saving ? "Saving…" : "Confirm"}</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
