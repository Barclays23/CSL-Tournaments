import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import {
  rescheduleSeasonMatch,
  updateSeasonMatchStatus,
} from "@/services/seasonMatchService";
import type { SeasonMatch, SeasonMatchStatus } from "@/types/seasonMatch.types";
import { formatDate, formatTime, fromDateTimeInput } from "@/utils/formatDate";

type StatusAction = "start" | "complete" | "postpone" | "cancel" | "abandon" | "reschedule";

const STATUS_LABEL: Record<SeasonMatchStatus, string> = {
  scheduled: "Scheduled",
  live: "Live",
  completed: "Completed",
  postponed: "Postponed",
  cancelled: "Cancelled",
  abandoned: "Abandoned",
};

const STATUS_TONE: Record<SeasonMatchStatus, string> = {
  scheduled: "border-info/30 bg-info/10 text-info",
  live: "border-success/30 bg-success/10 text-success",
  completed: "border-line bg-glass text-muted",
  postponed: "border-warning/30 bg-warning/10 text-warning",
  cancelled: "border-danger/30 bg-danger/10 text-danger",
  abandoned: "border-danger/30 bg-danger/10 text-danger",
};

const ACTIONS: Record<SeasonMatchStatus, StatusAction[]> = {
  scheduled: ["start", "postpone", "cancel"],
  live: ["complete", "postpone", "abandon"],
  postponed: ["reschedule", "cancel"],
  completed: [],
  cancelled: [],
  abandoned: [],
};

const ACTION_LABEL: Record<StatusAction, string> = {
  start: "Start match",
  complete: "Complete match",
  postpone: "Postpone match",
  cancel: "Cancel match",
  abandon: "Abandon match",
  reschedule: "Reschedule match",
};

const ACTION_DESCRIPTION: Record<StatusAction, string> = {
  start: "The match will move to Live. You can then record match events and goals.",
  complete: "The backend will validate the recorded score and season result rules before completing this match.",
  postpone: "The original fixture date and kick-off time will be retained in the status history. Enter a reason for postponement.",
  cancel: "The fixture will be marked as cancelled and cannot be reopened. Enter the reason for this decision.",
  abandon: "The fixture will be marked as abandoned and cannot be reopened. Enter the reason for this decision.",
  reschedule: "Choose a new date and kick-off time. The previous fixture time will remain available in the status history.",
};

function getTeam(ref: SeasonMatch["homeSeasonTeamRef"]) {
  return typeof ref === "string" ? { id: ref, name: "Team" } : { id: ref._id, name: ref.displayName };
}

function actionVariant(action: StatusAction): "primary" | "accent" | "danger" | "surface" {
  if (action === "start") return "accent";
  if (action === "complete") return "primary";
  if (action === "cancel" || action === "abandon") return "danger";
  return "surface";
}

function resolutionDetails(match: SeasonMatch) {
  const resolution = [...(match.resolutionHistory ?? [])]
    .reverse()
    .find((entry) => entry.status === match.status);
  const statusEvent = [...(match.statusHistory ?? [])]
    .reverse()
    .find((entry) => entry.toStatus === match.status);

  return {
    reason: resolution?.reason ?? statusEvent?.reason ?? null,
    changedAt: resolution?.decidedAt ?? statusEvent?.changedAt ?? null,
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
  const [activeAction, setActiveAction] = useState<StatusAction | null>(null);
  const [reason, setReason] = useState("");
  const [newKickoff, setNewKickoff] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const home = getTeam(match.homeSeasonTeamRef);
  const away = getTeam(match.awaySeasonTeamRef);
  const homeScore = match.goals.filter((goal) => {
    const team = goal.scoringSeasonTeamRef;
    return (typeof team === "string" ? team : team._id) === home.id;
  }).length;
  const awayScore = match.goals.filter((goal) => {
    const team = goal.scoringSeasonTeamRef;
    return (typeof team === "string" ? team : team._id) === away.id;
  }).length;
  const winner = match.winnerSeasonTeamRef
    ? typeof match.winnerSeasonTeamRef === "string" ? match.winnerSeasonTeamRef : match.winnerSeasonTeamRef._id
    : null;

  const closeAction = () => {
    if (saving) return;
    setActiveAction(null);
    setReason("");
    setNewKickoff("");
    setSubmitError("");
  };

  const openAction = (action: StatusAction) => {
    setReason("");
    setNewKickoff("");
    setSubmitError("");
    setActiveAction(action);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeAction || saving) return;

    const normalizedReason = reason.trim();
    const requiresReason = ["postpone", "cancel", "abandon"].includes(activeAction);
    if (requiresReason && normalizedReason.length < 3) {
      setSubmitError("Enter a reason with at least 3 characters.");
      return;
    }
    if (activeAction === "reschedule" && !newKickoff) {
      setSubmitError("Choose the new match date and kick-off time.");
      return;
    }
    if (activeAction === "reschedule" && normalizedReason.length > 0 && normalizedReason.length < 3) {
      setSubmitError("A rescheduling note must contain at least 3 characters, or be left empty.");
      return;
    }

    setSaving(true);
    setSubmitError("");
    try {
      let response;
      if (activeAction === "reschedule") {
        response = await rescheduleSeasonMatch(seasonId, match._id, {
          kickoffAt: fromDateTimeInput(newKickoff),
          ...(normalizedReason ? { reason: normalizedReason } : {}),
        });
      } else {
        const nextStatus: SeasonMatchStatus = activeAction === "start"
          ? "live"
          : activeAction === "complete"
            ? "completed"
            : activeAction === "postpone"
              ? "postponed"
              : activeAction === "cancel"
                ? "cancelled"
                : "abandoned";

        response = await updateSeasonMatchStatus(seasonId, match._id, {
          status: nextStatus,
          ...(activeAction === "postpone" ? { statusReason: normalizedReason } : {}),
          ...(activeAction === "cancel" || activeAction === "abandon"
            ? { resolutionReason: normalizedReason }
            : {}),
        });
      }

      onMatchUpdated(response.data);
      toast.success(activeAction === "reschedule" ? "Match rescheduled successfully" : `${ACTION_LABEL[activeAction]} successful`);
      setActiveAction(null);
      setReason("");
      setNewKickoff("");
      setSubmitError("");
    } catch (error) {
      const apiError = error as { message?: string; fieldErrors?: Record<string, string> };
      const fieldMessage = apiError.fieldErrors ? Object.values(apiError.fieldErrors).join(" ") : "";
      const message = [apiError.message || (error instanceof Error ? error.message : "Unable to update match status"), fieldMessage]
        .filter(Boolean)
        .join(" ");
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const actions = ACTIONS[match.status];
  const details = resolutionDetails(match);
  const isTerminal = match.status === "cancelled" || match.status === "abandoned";
  const resultLabel = winner === home.id
    ? `${home.name} won`
    : winner === away.id
      ? `${away.name} won`
      : homeScore === awayScore
        ? "Match drawn"
        : "Result recorded";

  return (
    <>
      <GlassCard className="mt-4 p-4 backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg text-fg">Match status</h2>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${STATUS_TONE[match.status]}`}>
                {STATUS_LABEL[match.status]}
              </span>
            </div>

            {match.status === "completed" ? (
              <div className="mt-2 text-sm text-muted">
                <p className="font-semibold text-fg">Final result · {homeScore} - {awayScore}</p>
                <p className="mt-0.5">{resultLabel}. This fixture is now read-only for normal status changes.</p>
              </div>
            ) : isTerminal ? (
              <div className="mt-2 text-sm text-muted">
                <p className="font-medium text-fg">This fixture is final and cannot be reopened.</p>
                {details.reason ? <p className="mt-1">{details.reason}</p> : <p className="mt-1">No resolution reason is available for this older fixture.</p>}
                {details.changedAt ? <p className="mt-1 text-xs text-faint">{formatDate(details.changedAt)} · {formatTime(details.changedAt)}</p> : null}
              </div>
            ) : match.status === "postponed" ? (
              <p className="mt-2 text-sm text-muted">This fixture is postponed. Reschedule it to assign a new date and kick-off time.</p>
            ) : match.status === "live" ? (
              <p className="mt-2 text-sm text-muted">The match is in progress. Complete, postpone or abandon it when appropriate.</p>
            ) : (
              <p className="mt-2 text-sm text-muted">Start the match when play begins, or postpone/cancel the fixture if required.</p>
            )}
          </div>

          {isAdmin && actions.length > 0 ? (
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              {actions.map((action) => (
                <Button
                  key={action}
                  size="sm"
                  variant={actionVariant(action)}
                  disabled={saving}
                  onClick={() => openAction(action)}
                >
                  {ACTION_LABEL[action]}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        {isTerminal && details.reason ? (
          <div className="mt-4 rounded-control border border-line bg-glass p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Resolution details</p>
            <p className="mt-1 text-fg">{details.reason}</p>
          </div>
        ) : null}
      </GlassCard>

      <Modal
        open={activeAction !== null}
        title={activeAction ? ACTION_LABEL[activeAction] : "Update match"}
        description={activeAction ? ACTION_DESCRIPTION[activeAction] : undefined}
        onClose={closeAction}
      >
        {activeAction ? (
          <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
            {["postpone", "cancel", "abandon"].includes(activeAction) ? (
              <label className="grid gap-2 text-sm font-semibold text-fg">
                Reason <span className="text-danger">*</span>
                <Textarea
                  required
                  minLength={3}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={
                    activeAction === "postpone"
                      ? "Why is this match being postponed?"
                      : activeAction === "cancel"
                        ? "Why is this fixture being cancelled?"
                        : "Why can this match not continue?"
                  }
                />
                <span className="text-xs font-normal text-muted">{reason.trim().length}/500 characters · Minimum 3 characters</span>
              </label>
            ) : null}

            {activeAction === "reschedule" ? (
              <>
                <label className="grid gap-2 text-sm font-semibold text-fg">
                  New date and kick-off time <span className="text-danger">*</span>
                  <Input
                    type="datetime-local"
                    required
                    value={newKickoff}
                    onChange={(event) => setNewKickoff(event.target.value)}
                  />
                  <span className="text-xs font-normal text-muted">Current fixture: {formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)} (India time)</span>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-fg">
                  Rescheduling note <span className="text-xs font-normal text-muted">(Optional)</span>
                  <Textarea
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Add a note about the new schedule, if needed."
                  />
                </label>
              </>
            ) : null}

            {activeAction === "start" || activeAction === "complete" ? (
              <div className="rounded-control border border-line bg-glass p-3 text-sm text-muted">
                {activeAction === "complete"
                  ? `Recorded score: ${homeScore} - ${awayScore}. The backend will check the score, draw rules and any required shootout.`
                  : "Confirm that the referee has started this match."}
              </div>
            ) : null}

            {submitError ? <p className="text-sm text-danger" role="alert">{submitError}</p> : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              <Button type="button" variant="surface" disabled={saving} onClick={closeAction}>Go back</Button>
              <Button
                type="submit"
                variant={activeAction === "cancel" || activeAction === "abandon" ? "danger" : "primary"}
                disabled={saving
                  || (["postpone", "cancel", "abandon"].includes(activeAction) && reason.trim().length < 3)
                  || (activeAction === "reschedule" && !newKickoff)}
              >
                {saving ? "Saving…" : activeAction === "reschedule" ? "Confirm reschedule" : `Confirm ${ACTION_LABEL[activeAction].toLowerCase()}`}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
