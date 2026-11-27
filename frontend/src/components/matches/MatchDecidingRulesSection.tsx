import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { updateSeasonMatchDecidingRules } from "@/services/seasonMatchService";
import type { Season } from "@/types/season.types";
import type { MatchDecidingRules, SeasonMatch } from "@/types/seasonMatch.types";

function sameExtraTime(a: MatchDecidingRules["extraTime"], b: MatchDecidingRules["extraTime"]) {
  return a.isAllowed === b.isAllowed && a.durationMinutes === b.durationMinutes;
}
function sameShootout(a: MatchDecidingRules["penaltyShootout"], b: MatchDecidingRules["penaltyShootout"]) {
  return a.isAllowed === b.isAllowed;
}

export function MatchDecidingRulesSection({
  seasonId,
  season,
  match,
  isAdmin,
  onMatchUpdated,
}: {
  seasonId: string;
  season: Season;
  match: SeasonMatch;
  isAdmin: boolean;
  onMatchUpdated: (match: SeasonMatch) => void;
}) {
  const defaults = season.matchRules;
  const [draft, setDraft] = useState<MatchDecidingRules>(match.decidingRules);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(match.decidingRules);
    setReason("");
  }, [match._id, match.decidingRules, match.updatedAt]);

  const groupStage = match.stage === "group";
  const extraTimeStarted = ["extra_time_first_half", "extra_time_half_time", "extra_time_second_half", "extra_time_completed", "penalty_shootout", "penalty_shootout_completed", "full_time"].includes(match.phase ?? "")
    || match.clock.periodElapsedSecondsByPeriod.extraTimeFirstHalf > 0
    || match.clock.periodElapsedSecondsByPeriod.extraTimeSecondHalf > 0
    || (match.auditHistory ?? []).some((entry) => ["phase_transition", "phase_correction"].includes(entry.action)
      && ["extra_time_first_half", "extra_time_half_time", "extra_time_second_half", "extra_time_completed"].includes(String(entry.newValue.phase ?? "")));
  const shootoutStarted = ["penalty_shootout", "penalty_shootout_completed", "full_time"].includes(match.phase ?? "")
    || Boolean(match.penaltyShootout)
    || (match.auditHistory ?? []).some((entry) => ["phase_transition", "phase_correction"].includes(entry.action)
      && ["penalty_shootout", "penalty_shootout_completed"].includes(String(entry.newValue.phase ?? "")));
  const completed = match.status === "completed" || match.phase === "full_time";
  const entireSectionLocked = !isAdmin || completed || shootoutStarted || groupStage;
  const extraTimeLocked = entireSectionLocked || extraTimeStarted;
  const shootoutLocked = entireSectionLocked;
  const extraInherited = Boolean(defaults && sameExtraTime(match.decidingRules.extraTime, {
    isAllowed: defaults.extraTime.isAllowedByDefault,
    durationMinutes: defaults.extraTime.defaultDurationMinutes,
  }));
  const shootoutInherited = Boolean(defaults && sameShootout(match.decidingRules.penaltyShootout, {
    isAllowed: defaults.penaltyShootout.isAllowedByDefault,
  }));
  const hasChanges = !sameExtraTime(draft.extraTime, match.decidingRules.extraTime)
    || !sameShootout(draft.penaltyShootout, match.decidingRules.penaltyShootout);
  const validDuration = Number.isSafeInteger(draft.extraTime.durationMinutes)
    && draft.extraTime.durationMinutes > 0 && draft.extraTime.durationMinutes % 2 === 0;
  const reasonRequired = Boolean(match.actualStartedAt);

  const save = async () => {
    if (!hasChanges || !validDuration || (reasonRequired && reason.trim().length < 3)) return;
    if (groupStage || entireSectionLocked) return;
    setSaving(true);
    try {
      const response = await updateSeasonMatchDecidingRules(seasonId, match._id, {
        extraTime: extraTimeLocked ? match.decidingRules.extraTime : draft.extraTime,
        penaltyShootout: shootoutLocked ? match.decidingRules.penaltyShootout : draft.penaltyShootout,
      }, reason.trim() || undefined);
      onMatchUpdated(response.data);
      setDraft(response.data.decidingRules);
      setReason("");
      toast.success("Match Deciding Rules updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update Match Deciding Rules");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard className="mt-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-fg">Match Deciding Rules</h2>
          <p className="mt-1 text-sm text-muted">These are the effective rules saved on this fixture. Changes are sent only through the dedicated Match Deciding Rules operation.</p>
        </div>
        {completed ? <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">Read only · Completed</span> : null}
      </div>

      {groupStage ? (
        <p className="mt-4 rounded-xl border border-info/30 bg-info/5 p-3 text-sm text-muted" role="status">
          Group Stage matches always finish at Regular Full Time. Extra Time and Penalty Shootout are disabled and saved as false, regardless of Season defaults.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-fg">Extra Time</h3>
            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${extraInherited ? "bg-surface text-muted" : "bg-primary/10 text-accent"}`}>{extraInherited ? "Inherited" : "Overridden"}</span>
          </div>
          <p className="mt-2 text-xs text-muted">Season default: {defaults?.extraTime.isAllowedByDefault ? `Allowed · ${defaults.extraTime.defaultDurationMinutes} minutes` : `Disabled · ${defaults?.extraTime.defaultDurationMinutes ?? "—"} minute default`}</p>
          <label className="mt-3 flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" className="accent-accent" checked={groupStage ? false : draft.extraTime.isAllowed} disabled={extraTimeLocked || saving}
              onChange={(event) => setDraft((current) => ({ ...current, extraTime: { ...current.extraTime, isAllowed: event.target.checked } }))} />
            Allow Extra Time for this Match
          </label>
          <label className="mt-3 block text-sm text-fg">
            Effective Extra Time duration (minutes)
            <Input className="mt-1" type="number" min={2} step={2} value={draft.extraTime.durationMinutes} disabled={extraTimeLocked || saving}
              onChange={(event) => setDraft((current) => ({ ...current, extraTime: { ...current.extraTime, durationMinutes: Number(event.target.value) } }))} />
            {!validDuration ? <span className="mt-1 block text-xs text-danger">Enter a positive even whole number of minutes.</span> : null}
          </label>
          {extraTimeStarted ? <p className="mt-2 text-xs text-muted">Extra Time settings are locked because Extra Time has started.</p> : null}
        </section>

        <section className="rounded-xl border border-line bg-surface/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-fg">Penalty Shootout</h3>
            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${shootoutInherited ? "bg-surface text-muted" : "bg-primary/10 text-accent"}`}>{shootoutInherited ? "Inherited" : "Overridden"}</span>
          </div>
          <p className="mt-2 text-xs text-muted">Season default: {defaults?.penaltyShootout.isAllowedByDefault ? "Allowed" : "Disabled"}</p>
          <label className="mt-3 flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" className="accent-accent" checked={groupStage ? false : draft.penaltyShootout.isAllowed} disabled={shootoutLocked || saving}
              onChange={(event) => setDraft((current) => ({ ...current, penaltyShootout: { isAllowed: event.target.checked } }))} />
            Allow Penalty Shootout for this Match
          </label>
          {shootoutStarted ? <p className="mt-2 text-xs text-muted">The deciding-rules section is locked because the Penalty Shootout has started.</p> : null}
        </section>
      </div>

      {!isAdmin ? <p className="mt-3 text-xs text-muted">Only administrators can edit Match Deciding Rules.</p> : null}
      {reasonRequired && !entireSectionLocked ? (
        <label className="mt-3 block text-sm text-fg">
          Change reason <span className="text-danger">*</span>
          <Textarea className="mt-1" rows={2} maxLength={1000} value={reason} disabled={saving} onChange={(event) => setReason(event.target.value)} placeholder="Explain why the deciding rules are being changed." />
          <span className="mt-1 block text-xs text-muted">Required after actual kickoff (minimum 3 characters).</span>
        </label>
      ) : null}
      {!entireSectionLocked && (extraTimeLocked || shootoutLocked) ? <p className="mt-2 text-xs text-muted">Settings already locked by a phase transition cannot be changed by editing the other option.</p> : null}
      {isAdmin && !entireSectionLocked ? (
        <div className="mt-4 flex justify-end">
          <Button size="sm" disabled={saving || !hasChanges || !validDuration || (reasonRequired && reason.trim().length < 3)} onClick={() => void save()}>{saving ? "Saving…" : "Save deciding rules"}</Button>
        </div>
      ) : null}
    </GlassCard>
  );
}
