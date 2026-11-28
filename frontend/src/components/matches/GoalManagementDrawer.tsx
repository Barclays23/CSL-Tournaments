import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { ICONS, TONES, ToneHeader, ToneIcon, fieldClass } from "@/components/ui/Tones";
import type { Asset } from "@/types/api.types";
import type { MatchTimedPeriod, SeasonMatch } from "@/types/seasonMatch.types";
import { formatMatchClock, getPeriodLabel, isEventTimeAheadOfClock } from "@/utils/matchTiming";
import { formatMatchEventTime } from "@/utils/matchTiming";

export interface GoalTeamOption {
  id: string;
  name: string;
  logo: Asset | null;
}

export interface GoalPlayerOption {
  id: string;
  name: string;
  profilePic: Asset | null;
  jerseyNo: number | null;
}

// Section tones for this drawer
const T_TEAM = TONES.success;
const T_TYPE = TONES.accent;
const T_PLAYER = TONES.info;
const T_TIME = TONES.gold;
const T_REASON = TONES.primary;

export function GoalManagementDrawer({
  open,
  onClose,
  editing,
  home,
  away,
  scoringTeamId,
  onScoringTeamChange,
  goalType,
  onGoalTypeChange,
  selectedPlayerId,
  onPlayerChange,
  players,
  period,
  periodOptions,
  onPeriodChange,
  minute,
  onMinuteChange,
  addedMinutes,
  onAddedMinutesChange,
  reason,
  onReasonChange,
  match,
  stoppageTimeAllowed,
  saving,
  error,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  editing: boolean;
  home: GoalTeamOption;
  away: GoalTeamOption;
  scoringTeamId: string;
  onScoringTeamChange: (id: string) => void;
  goalType: "normal" | "own_goal";
  onGoalTypeChange: (type: "normal" | "own_goal") => void;
  selectedPlayerId: string;
  onPlayerChange: (id: string) => void;
  players: GoalPlayerOption[];
  period: MatchTimedPeriod | null;
  periodOptions: MatchTimedPeriod[];
  onPeriodChange: (period: MatchTimedPeriod) => void;
  minute: number;
  onMinuteChange: (minute: number) => void;
  addedMinutes: number;
  onAddedMinutesChange: (minutes: number) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  match: SeasonMatch;
  stoppageTimeAllowed: boolean;
  saving: boolean;
  error?: string | null;
  onSubmit: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open || !match.clock.isRunning) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open, match.clock.isRunning]);
  const timeIsAhead = isEventTimeAheadOfClock(match, period, minute, addedMinutes, now);
  const clockPosition = formatMatchClock(match, now);
  const creditedTeam = scoringTeamId === away.id ? away : home;
  const playerTeam = goalType === "normal" ? creditedTeam : creditedTeam.id === home.id ? away : home;
  const canSave = !saving && !timeIsAhead && (goalType === "own_goal" || selectedPlayerId !== "") && Boolean(period) && minute > 0;

  return (
    <Drawer
      open={open}
      title={editing ? "Edit goal" : "Record a goal"}
      description="Choose the goal details and the match-clock time. The event time does not change the Match clock."
      onClose={onClose}
    >
      <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <section className={`rounded-2xl border p-3 backdrop-blur-xl ${T_TEAM.section}`}>
          <ToneHeader tone="success" icon={<ToneIcon d={ICONS.users} />} title="Team credited" className="mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {[home, away].map((team) => {
              const selected = scoringTeamId === team.id;
              return (
                <button key={team.id} type="button" aria-pressed={selected} onClick={() => onScoringTeamChange(team.id)}
                  className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? `${T_TEAM.cardOn} ring-1 ring-success/30` : T_TEAM.cardOff}`}>
                  <Avatar name={team.name} asset={team.logo} className="h-11 w-11 shrink-0 rounded-lg" />
                  <span className="min-w-0"><span className={`block text-[10px] font-semibold uppercase tracking-wide ${T_TEAM.text}`}>{team.id === home.id ? "Home" : "Away"}</span><span className="block truncate text-sm font-semibold text-fg">{team.name}</span></span>
                  {selected ? <span className={`ml-auto ${T_TEAM.text}`}>✓</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className={`rounded-2xl border p-3 backdrop-blur-xl ${T_TYPE.section}`}>
          <ToneHeader tone="accent" icon={<ToneIcon d={ICONS.flag} />} title="Goal type" className="mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: "normal" as const, label: "Normal goal", hint: "Scored for the team", symbol: "⚽" },
              { value: "own_goal" as const, label: "Own goal", hint: "Credited to opponent", symbol: "↗" },
            ]).map((option) => {
              const selected = goalType === option.value;
              return (
                <button key={option.value} type="button" aria-pressed={selected} onClick={() => onGoalTypeChange(option.value)}
                  className={`rounded-xl border p-3 text-left transition ${selected ? `${T_TYPE.cardOn} ring-1 ring-accent/30` : T_TYPE.cardOff}`}>
                  <span className="text-xl">{option.symbol}</span><span className="mt-2 block text-sm font-semibold text-fg">{option.label}</span><span className="mt-0.5 block text-xs text-muted">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={`rounded-2xl border p-3 backdrop-blur-xl ${T_PLAYER.section}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <ToneHeader tone="info" icon={<ToneIcon d={ICONS.users} />} title={goalType === "own_goal" ? "Opposing player" : "Goal scorer"} />
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${T_PLAYER.pill}`}>{playerTeam.name}</span>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {goalType === "own_goal" ? (
              <button type="button" aria-pressed={selectedPlayerId === ""} onClick={() => onPlayerChange("")}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selectedPlayerId === "" ? T_PLAYER.cardOn : T_PLAYER.cardOff}`}>
                <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${T_PLAYER.chip}`}>?</span><span className="text-sm font-medium text-fg">Player not recorded</span>{selectedPlayerId === "" ? <span className={`ml-auto ${T_PLAYER.text}`}>✓</span> : null}
              </button>
            ) : null}
            {players.length ? players.map((player) => {
              const selected = selectedPlayerId === player.id;
              return (
                <button key={player.id} type="button" aria-pressed={selected} onClick={() => onPlayerChange(player.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${selected ? `${T_PLAYER.cardOn} ring-1 ring-info/20` : T_PLAYER.cardOff}`}>
                  <Avatar name={player.name} asset={player.profilePic} className="h-10 w-10 shrink-0" /><span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{player.name}</span><span className={`rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums ${T_PLAYER.chipOn}`}>#{player.jerseyNo ?? "—"}</span>{selected ? <span className={T_PLAYER.text}>✓</span> : null}
                </button>
              );
            }) : <p className={`rounded-xl border border-dashed p-4 text-center text-sm text-muted ${T_PLAYER.divider}`}>No eligible players found for {playerTeam.name}.</p>}
          </div>
          <p className="mt-2 text-xs text-muted">{goalType === "own_goal" ? "Select a player from the opposing team. The goal will be credited to the selected team." : "Only players registered to the credited team are shown."}</p>
        </section>

        <section className={`rounded-2xl border p-3 backdrop-blur-xl ${T_TIME.section} ${T_TIME.labels}`}>
          <div className="flex items-center justify-between gap-2">
            <ToneHeader tone="gold" icon={<ToneIcon d={ICONS.clock} />} title="Event time" />
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${T_TIME.pill}`}>Clock position · {clockPosition}</span>
          </div>
          <label className="mt-3 block text-sm">Match period
            <select className={fieldClass("gold", "mt-1 w-full")} required value={period ?? ""} onChange={(event) => onPeriodChange(event.target.value as MatchTimedPeriod)}>
              <option value="" disabled>Select a completed period</option>
              {periodOptions.map((value) => <option key={value} value={value}>{getPeriodLabel(value)}</option>)}
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-sm">Match minute
              <input className={fieldClass("gold", "mt-1 w-full")} type="number" min={1} step={1} required value={minute} onChange={(event) => onMinuteChange(Number(event.target.value))} />
            </label>
            <label className="block text-sm">Added / stoppage minutes
              <input className={fieldClass("gold", "mt-1 w-full disabled:opacity-50")} type="number" min={0} step={1} value={addedMinutes} disabled={!stoppageTimeAllowed} onChange={(event) => onAddedMinutesChange(Number(event.target.value))} />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">Use the cumulative match minute (for example, 27' after 12 minutes of the second half in a 30-minute Match). Added minutes are only valid at the period boundary.</p>
          <p className={`mt-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${T_TIME.note}`}>Event notation · {formatMatchEventTime(period, minute, addedMinutes)}</p>
          {timeIsAhead ? <p className="mt-2 text-xs text-danger" role="alert">This event time is later than the current or stored Match clock position, or belongs to an unavailable period.</p> : null}
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        </section>

        {editing ? <section className={`rounded-2xl border p-3 backdrop-blur-xl ${T_REASON.section} ${T_REASON.labels}`}>
          <label className="grid gap-1 text-sm">Correction reason
            <input className={fieldClass("primary")} maxLength={1000} value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Why is this Goal being corrected?" />
          </label>
        </section> : null}
        <div className="flex gap-2 border-t border-line pt-4"><Button type="button" variant="surface" className="flex-1" onClick={onClose}>Cancel</Button><Button type="submit" className="flex-1" disabled={!canSave || (editing && reason.trim().length < 3)}>{saving ? "Saving…" : editing ? "Save changes" : "Save goal"}</Button></div>
      </form>
    </Drawer>
  );
}