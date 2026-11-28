import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { ICONS, TONES, ToneHeader, ToneIcon, fieldClass } from "@/components/ui/Tones";
import type { MatchTimedPeriod, SeasonMatch, SeasonMatchCardType } from "@/types/seasonMatch.types";
import { formatMatchClock, isEventTimeAheadOfClock } from "@/utils/matchTiming";
import { formatMatchEventTime, getPeriodLabel } from "@/utils/matchTiming";

type Team = { id: string; name: string };
type Player = { id: string; name: string; jerseyNo: number | null };
const options: Array<{ value: SeasonMatchCardType; label: string }> = [
  { value: "yellow_card", label: "Yellow card" },
  { value: "red_card", label: "Red card" },
  { value: "second_yellow", label: "Second yellow card" },
];

export function CardManagementDrawer({
  open, onClose, editing, home, away, teamId, onTeamChange, cardType, onCardTypeChange, playerId, onPlayerChange, players,
  period, periodOptions, onPeriodChange, minute, onMinuteChange, addedMinutes, onAddedMinutesChange, reason, onReasonChange, match,
  stoppageTimeAllowed, saving, error, onSubmit,
}: {
  open: boolean; onClose: () => void; editing: boolean; home: Team; away: Team; teamId: string; onTeamChange: (id: string) => void;
  cardType: SeasonMatchCardType; onCardTypeChange: (type: SeasonMatchCardType) => void; playerId: string; onPlayerChange: (id: string) => void;
  players: Player[]; period: MatchTimedPeriod | null; periodOptions: MatchTimedPeriod[]; onPeriodChange: (period: MatchTimedPeriod) => void;
  minute: number; onMinuteChange: (minute: number) => void; addedMinutes: number; onAddedMinutesChange: (minutes: number) => void; reason: string; onReasonChange: (reason: string) => void;
  match: SeasonMatch; stoppageTimeAllowed: boolean; saving: boolean; error?: string | null; onSubmit: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open || !match.clock.isRunning) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open, match.clock.isRunning]);
  const timeIsAhead = isEventTimeAheadOfClock(match, period, minute, addedMinutes, now);
  const clockPosition = formatMatchClock(match, now);
  const tTeam = TONES.primary;
  const tCard = TONES.gold;
  const tPlayer = TONES.info;
  const tTime = TONES.accent;
  const tReason = TONES.success;
  return <Drawer open={open} title={editing ? "Edit card" : "Record a card"} description="Choose the team, player and card time. Event time changes do not change the Match clock." onClose={onClose}>
    <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <section className={`grid gap-3 rounded-2xl border p-3 backdrop-blur-xl ${tTeam.section} ${tTeam.labels}`}>
        <ToneHeader tone="primary" icon={<ToneIcon d={ICONS.users} />} title="Team" />
        <label className="grid gap-1.5 text-sm">Team<select className={fieldClass("primary")} value={teamId} onChange={(event) => { onTeamChange(event.target.value); onPlayerChange(""); }}><option value={home.id}>{home.name}</option><option value={away.id}>{away.name}</option></select></label>
      </section>
      <section className={`grid gap-3 rounded-2xl border p-3 backdrop-blur-xl ${tCard.section} ${tCard.labels}`}>
        <ToneHeader tone="gold" icon={<ToneIcon d={ICONS.card} />} title="Card" />
        <label className="grid gap-1.5 text-sm">Card<select className={fieldClass("gold")} value={cardType} onChange={(event) => onCardTypeChange(event.target.value as SeasonMatchCardType)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </section>
      <section className={`grid gap-3 rounded-2xl border p-3 backdrop-blur-xl ${tPlayer.section} ${tPlayer.labels}`}>
        <ToneHeader tone="info" icon={<ToneIcon d={ICONS.users} />} title="Player" />
        <label className="grid gap-1.5 text-sm">Player<select required className={fieldClass("info")} value={playerId} onChange={(event) => onPlayerChange(event.target.value)}><option value="">Select a player</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}{player.jerseyNo ? ` · #${player.jerseyNo}` : ""}</option>)}</select></label>
      </section>

      <section className={`rounded-2xl border p-3 backdrop-blur-xl ${tTime.section} ${tTime.labels}`}>
        <div className="flex items-center justify-between gap-2"><ToneHeader tone="accent" icon={<ToneIcon d={ICONS.clock} />} title="Event time" /><span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tTime.pill}`}>Clock position · {clockPosition}</span></div>
        <label className="mt-3 block text-sm">Match period
          <select className={fieldClass("accent", "mt-1 w-full")} required value={period ?? ""} onChange={(event) => onPeriodChange(event.target.value as MatchTimedPeriod)}>
            <option value="" disabled>Select a completed period</option>{periodOptions.map((value) => <option key={value} value={value}>{getPeriodLabel(value)}</option>)}
          </select>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">Match minute<input className={fieldClass("accent", "mt-1 w-full")} type="number" min={1} step={1} required value={minute} onChange={(event) => onMinuteChange(Number(event.target.value))} /></label>
          <label className="block text-sm">Added / stoppage minutes<input className={fieldClass("accent", "mt-1 w-full disabled:opacity-50")} type="number" min={0} step={1} value={addedMinutes} disabled={!stoppageTimeAllowed} onChange={(event) => onAddedMinutesChange(Number(event.target.value))} /></label>
        </div>
        <p className="mt-2 text-xs text-muted">Select a cumulative match minute. Added minutes are valid only at the nominal end of a period.</p>
        <p className={`mt-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${tTime.note}`}>Event notation · {formatMatchEventTime(period, minute, addedMinutes)}</p>
        {timeIsAhead ? <p className="mt-2 text-xs text-danger" role="alert">This event time is later than the current or stored Match clock position, or belongs to an unavailable period.</p> : null}
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </section>
      {editing ? <section className={`rounded-2xl border p-3 backdrop-blur-xl ${tReason.section} ${tReason.labels}`}><label className="grid gap-1 text-sm">Correction reason<input className={fieldClass("success")} maxLength={1000} value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Why is this card being corrected?" /></label></section> : null}
      <div className="flex gap-2 border-t border-line pt-4"><Button type="button" variant="surface" className="flex-1" onClick={onClose}>Cancel</Button><Button type="submit" className="flex-1" disabled={saving || !playerId || !period || timeIsAhead || (editing && reason.trim().length < 3)}>{saving ? "Saving…" : editing ? "Save changes" : "Record card"}</Button></div>
    </form>
  </Drawer>;
}