import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { ICONS, TONES, ToneHeader, ToneIcon, fieldClass } from "@/components/ui/Tones";
import type { MatchTimedPeriod, SeasonMatch, SeasonMatchCorrectionWrite } from "@/types/seasonMatch.types";

type Team = { id: string; name: string };
type Player = { id: string; name: string; seasonTeamId: string };
type EditableGoal = { scoringSeasonTeamRef: string; scorerPlayerRef: string | null; goalType: "normal" | "own_goal"; period: MatchTimedPeriod | null; minute: number | null; addedMinutes: number };

function refId(value: string | { _id: string } | null | undefined): string {
  return typeof value === "string" ? value : value?._id ?? "";
}

export function CompletedMatchCorrectionDrawer({
  open, onClose, match, home, away, players, saving, onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  match: SeasonMatch;
  home: Team;
  away: Team;
  players: Player[];
  saving: boolean;
  onSubmit: (data: SeasonMatchCorrectionWrite) => void;
}) {
  const [reason, setReason] = useState("");
  const [goals, setGoals] = useState<EditableGoal[]>(() => match.goals.map((goal) => ({
    scoringSeasonTeamRef: refId(goal.scoringSeasonTeamRef),
    scorerPlayerRef: goal.scorerPlayerRef ? refId(goal.scorerPlayerRef) : null,
    goalType: goal.goalType,
    period: goal.period ?? null,
    minute: goal.minute ?? null,
    addedMinutes: goal.addedMinutes ?? 0,
  })));
  const [teamId, setTeamId] = useState(home.id);
  const [goalType, setGoalType] = useState<"normal" | "own_goal">("normal");
  const [playerId, setPlayerId] = useState("");
  const [newGoalPeriod, setNewGoalPeriod] = useState<MatchTimedPeriod | "">("");
  const [newGoalMinute, setNewGoalMinute] = useState("");
  const [newGoalAddedMinutes, setNewGoalAddedMinutes] = useState("0");
  const [shootout, setShootout] = useState<SeasonMatch["penaltyShootout"]>(() => match.penaltyShootout ? { ...match.penaltyShootout, kicks: match.penaltyShootout.kicks.map((kick) => ({ ...kick })) } : null);

  const playerTeamId = goalType === "normal" ? teamId : teamId === home.id ? away.id : home.id;
  const eligiblePlayers = useMemo(() => players.filter((player) => player.seasonTeamId === playerTeamId), [players, playerTeamId]);

  const addGoal = () => {
    if (!teamId || !newGoalPeriod || !Number.isSafeInteger(Number(newGoalMinute)) || Number(newGoalMinute) <= 0
      || !Number.isSafeInteger(Number(newGoalAddedMinutes)) || Number(newGoalAddedMinutes) < 0
      || (goalType === "normal" && !playerId)) return;
    const periodLength = newGoalPeriod.startsWith("extra_time_") ? match.decidingRules.extraTime.durationMinutes / 2 : match.matchDurationMinutes / 2;
    const periodBase = newGoalPeriod === "first_half" ? 0
      : newGoalPeriod === "second_half" ? match.matchDurationMinutes / 2
        : newGoalPeriod === "extra_time_first_half" ? match.matchDurationMinutes
          : match.matchDurationMinutes + match.decidingRules.extraTime.durationMinutes / 2;
    const boundary = periodBase + periodLength;
    if (Number(newGoalMinute) <= periodBase || Number(newGoalMinute) > boundary
      || (Number(newGoalAddedMinutes) > 0 && Number(newGoalMinute) !== boundary)) return;
    setGoals((current) => [...current, {
      scoringSeasonTeamRef: teamId,
      scorerPlayerRef: playerId || null,
      goalType,
      period: newGoalPeriod,
      minute: Number(newGoalMinute),
      addedMinutes: Number(newGoalAddedMinutes),
    }]);
    setPlayerId("");
    setNewGoalPeriod("");
    setNewGoalMinute("");
    setNewGoalAddedMinutes("0");
  };

  const submit = () => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) return;
    onSubmit({
      reason: trimmed,
      goals,
      penaltyShootout: shootout,
    });
  };

  const tWarn = TONES.gold;
  const tGoals = TONES.success;
  const tRow = TONES.primary;
  const tNew = TONES.info;
  const tShoot = TONES.accent;
  const tReason = TONES.gold;

  return (
    <Drawer open={open} title="Correct completed match" description="This is an audited correction. The original result will be retained in the correction history." onClose={onClose}>
      <div className="grid gap-5">
        <div className={`flex items-start gap-3 rounded-2xl border p-3 text-sm text-muted backdrop-blur-xl ${tWarn.section}`}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tWarn.chip}`}><ToneIcon d={ICONS.alert} /></span>
          <div className="min-w-0">
            Current recorded score: <strong className="text-fg">{match.goals.filter((goal) => refId(goal.scoringSeasonTeamRef) === home.id).length} - {match.goals.filter((goal) => refId(goal.scoringSeasonTeamRef) === away.id).length}</strong>
            {match.penaltyShootout ? <p className="mt-1">Penalty shootout: {match.penaltyShootout.homeTeamScore} - {match.penaltyShootout.awayTeamScore} (will be retained)</p> : null}
          </div>
        </div>

        <section className={`grid gap-3 rounded-2xl border p-3 backdrop-blur-xl ${tGoals.section} ${tGoals.labels}`}>
          <div className="flex items-center justify-between">
            <ToneHeader tone="success" icon={<ToneIcon d={ICONS.flag} />} title="Correct goal events" />
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tGoals.pill}`}>{goals.length} goal(s)</span>
          </div>
          {goals.length ? <ul className="space-y-2">
            {goals.map((goal, index) => {
              const team = goal.scoringSeasonTeamRef === home.id ? home : away;
              const scorer = players.find((player) => player.id === goal.scorerPlayerRef)?.name ?? (goal.goalType === "own_goal" ? "Unspecified own goal" : "Unknown scorer");
              return <li key={index} className={`grid gap-2 rounded-xl border p-3 text-sm ${tRow.cardOff} ${tRow.labels}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0"><strong className="text-fg">{team.name}</strong><span className="block truncate text-muted">{scorer}{goal.goalType === "own_goal" ? " · Own goal" : ""}</span></span>
                  <button type="button" className="shrink-0 text-xs font-semibold text-danger" onClick={() => setGoals((current) => current.filter((_, i) => i !== index))}>Remove</button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="grid gap-1 text-xs">Period
                    <select className={fieldClass("primary")} value={goal.period ?? ""} onChange={(event) => setGoals((current) => current.map((item, i) => i === index ? { ...item, period: (event.target.value || null) as MatchTimedPeriod|null, minute: null, addedMinutes: 0 } : item))}>
                      <option value="">Not recorded (legacy)</option><option value="first_half">First Half</option><option value="second_half">Second Half</option>
                      {match.stage !== "group" && match.decidingRules.extraTime.isAllowed ? <><option value="extra_time_first_half">Extra Time First Half</option><option value="extra_time_second_half">Extra Time Second Half</option></> : null}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs">Cumulative minute
                    <input className={fieldClass("primary")} type="number" min={1} step={1} value={goal.minute ?? ""} onChange={(event) => setGoals((current) => current.map((item, i) => i === index ? { ...item, minute: event.target.value === "" ? null : Number(event.target.value) } : item))} />
                  </label>
                  <label className="grid gap-1 text-xs">Added minutes
                    <input className={fieldClass("primary")} type="number" min={0} step={1} value={goal.addedMinutes} onChange={(event) => setGoals((current) => current.map((item, i) => i === index ? { ...item, addedMinutes: Number(event.target.value) } : item))} />
                  </label>
                </div>
              </li>;
            })}
          </ul> : <p className="text-sm text-muted">No goal events. A 0-0 result is valid when competition rules allow it.</p>}

          <div className={`grid gap-2 rounded-xl border p-3 ${tNew.section} ${tNew.labels}`}>
            <ToneHeader tone="info" icon={<ToneIcon d={ICONS.edit} />} title="Add a corrected goal" />
            <label className="grid gap-1 text-xs">Team credited
              <select className={fieldClass("info")} value={teamId} onChange={(event) => { setTeamId(event.target.value); setPlayerId(""); }}>
                <option value={home.id}>{home.name}</option><option value={away.id}>{away.name}</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs">Goal type
              <select className={fieldClass("info")} value={goalType} onChange={(event) => { setGoalType(event.target.value as "normal" | "own_goal"); setPlayerId(""); }}>
                <option value="normal">Normal goal</option><option value="own_goal">Own goal</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs">{goalType === "own_goal" ? "Responsible player (optional)" : "Goal scorer"}
              <select className={fieldClass("info")} value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
                <option value=""> {goalType === "own_goal" ? "Player not recorded" : "Select player"} </option>
                {eligiblePlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
              </select>
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="grid gap-1 text-xs">Period
                <select className={fieldClass("info")} value={newGoalPeriod} onChange={(event) => setNewGoalPeriod(event.target.value as MatchTimedPeriod | "")}>
                  <option value="">Select period</option><option value="first_half">First Half</option><option value="second_half">Second Half</option>
                  {match.stage !== "group" && match.decidingRules.extraTime.isAllowed ? <><option value="extra_time_first_half">Extra Time First Half</option><option value="extra_time_second_half">Extra Time Second Half</option></> : null}
                </select>
              </label>
              <label className="grid gap-1 text-xs">Cumulative minute
                <input className={fieldClass("info")} type="number" min={1} step={1} value={newGoalMinute} onChange={(event) => setNewGoalMinute(event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs">Added minutes
                <input className={fieldClass("info")} type="number" min={0} step={1} value={newGoalAddedMinutes} onChange={(event) => setNewGoalAddedMinutes(event.target.value)} />
              </label>
            </div>
            <Button type="button" variant="surface" onClick={addGoal} disabled={!newGoalPeriod || !newGoalMinute || (goalType === "normal" && !playerId)}>Add corrected goal</Button>
          </div>
        </section>


        {match.stage !== "group" ? (
          <section className={`grid gap-2 rounded-2xl border p-3 backdrop-blur-xl ${tShoot.section} ${tShoot.labels}`}>
            <div className="flex items-center justify-between gap-2">
              <ToneHeader tone="accent" icon={<ToneIcon d={ICONS.target} />} title="Penalty shootout" />
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" className="accent-accent" checked={shootout !== null} onChange={(event) => setShootout(event.target.checked ? { status: "completed", homeTeamScore: 0, awayTeamScore: 0, kicks: [] } : null)} />
                Include shootout
              </label>
            </div>
            {shootout ? (
              <>
                <p className="text-xs text-muted">Shootout scores are validated against the competition rules. Existing kick details are retained unless cleared.</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-xs">{home.name} shootout score
                    <input type="number" min="0" step="1" className={fieldClass("accent")} value={shootout.homeTeamScore} onChange={(event) => setShootout({ ...shootout, homeTeamScore: Number(event.target.value) })} />
                  </label>
                  <label className="grid gap-1 text-xs">{away.name} shootout score
                    <input type="number" min="0" step="1" className={fieldClass("accent")} value={shootout.awayTeamScore} onChange={(event) => setShootout({ ...shootout, awayTeamScore: Number(event.target.value) })} />
                  </label>
                </div>
                {shootout.kicks.length ? <button type="button" className="text-left text-xs font-semibold text-warning" onClick={() => setShootout({ ...shootout, kicks: [] })}>Clear kick-by-kick details and use score-only shootout record</button> : null}
              </>
            ) : <p className="text-xs text-muted">No penalty shootout will be recorded. If the corrected knockout score is tied and the season requires a shootout, validation will reject the correction.</p>}
          </section>
        ) : null}

        <section className={`rounded-2xl border p-3 backdrop-blur-xl ${tReason.section} ${tReason.labels}`}>
          <label className="grid gap-1 text-sm">Mandatory correction reason
            <textarea className={fieldClass("gold", "min-h-24 rounded-xl font-normal")} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Explain why this completed match result needs correction." />
            <span className="text-xs font-normal text-muted">{reason.trim().length}/1000 characters · Minimum 3</span>
          </label>
        </section>

        <div className="flex gap-2 border-t border-line pt-4">
          <Button type="button" variant="surface" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="button" className="flex-1" disabled={saving || reason.trim().length < 3} onClick={submit}>{saving ? "Saving correction…" : "Confirm correction"}</Button>
        </div>
      </div>
    </Drawer>
  );
}