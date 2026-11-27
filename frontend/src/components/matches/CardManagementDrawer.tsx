import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import type { MatchTimedPeriod, SeasonMatchCardType } from "@/types/seasonMatch.types";
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
  period, periodOptions, onPeriodChange, minute, onMinuteChange, addedMinutes, onAddedMinutesChange, clockPosition,
  stoppageTimeAllowed, timeIsAhead, saving, error, onSubmit,
}: {
  open: boolean; onClose: () => void; editing: boolean; home: Team; away: Team; teamId: string; onTeamChange: (id: string) => void;
  cardType: SeasonMatchCardType; onCardTypeChange: (type: SeasonMatchCardType) => void; playerId: string; onPlayerChange: (id: string) => void;
  players: Player[]; period: MatchTimedPeriod | null; periodOptions: MatchTimedPeriod[]; onPeriodChange: (period: MatchTimedPeriod) => void;
  minute: number; onMinuteChange: (minute: number) => void; addedMinutes: number; onAddedMinutesChange: (minutes: number) => void;
  clockPosition: string; stoppageTimeAllowed: boolean; timeIsAhead: boolean; saving: boolean; error?: string | null; onSubmit: () => void;
}) {
  return <Drawer open={open} title={editing ? "Edit card" : "Record a card"} description="Choose the team, player and card time. Event time changes do not change the Match clock." onClose={onClose}>
    <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <label className="grid gap-1.5 text-sm font-semibold text-fg">Team<select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={teamId} onChange={(event) => { onTeamChange(event.target.value); onPlayerChange(""); }}><option value={home.id}>{home.name}</option><option value={away.id}>{away.name}</option></select></label>
      <label className="grid gap-1.5 text-sm font-semibold text-fg">Card<select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={cardType} onChange={(event) => onCardTypeChange(event.target.value as SeasonMatchCardType)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="grid gap-1.5 text-sm font-semibold text-fg">Player<select required className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={playerId} onChange={(event) => onPlayerChange(event.target.value)}><option value="">Select a player</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}{player.jerseyNo ? ` · #${player.jerseyNo}` : ""}</option>)}</select></label>

      <section className="rounded-xl border border-line bg-surface/40 p-3">
        <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-fg">Event time</h3><span className="text-xs text-muted">Clock position · {clockPosition}</span></div>
        <label className="mt-3 block text-sm text-fg">Match period
          <select className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" required value={period ?? ""} onChange={(event) => onPeriodChange(event.target.value as MatchTimedPeriod)}>
            <option value="" disabled>Select a completed period</option>{periodOptions.map((value) => <option key={value} value={value}>{getPeriodLabel(value)}</option>)}
          </select>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm text-fg">Match minute<input className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" type="number" min={1} step={1} required value={minute} onChange={(event) => onMinuteChange(Number(event.target.value))} /></label>
          <label className="block text-sm text-fg">Added / stoppage minutes<input className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" type="number" min={0} step={1} value={addedMinutes} disabled={!stoppageTimeAllowed} onChange={(event) => onAddedMinutesChange(Number(event.target.value))} /></label>
        </div>
        <p className="mt-2 text-xs text-muted">Select a cumulative match minute. Added minutes are valid only at the nominal end of a period.</p>
        <p className="mt-2 text-sm font-semibold text-fg">Event notation · {formatMatchEventTime(period, minute, addedMinutes)}</p>
        {timeIsAhead ? <p className="mt-2 text-xs text-danger" role="alert">This event time is later than the current or stored Match clock position, or belongs to an unavailable period.</p> : null}
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </section>
      <div className="flex gap-2 border-t border-line pt-4"><Button type="button" variant="surface" className="flex-1" onClick={onClose}>Cancel</Button><Button type="submit" className="flex-1" disabled={saving || !playerId || !period || timeIsAhead}>{saving ? "Saving…" : editing ? "Save changes" : "Record card"}</Button></div>
    </form>
  </Drawer>;
}
