import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import type { Asset } from "@/types/api.types";

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
  saving: boolean;
  error?: string | null;
  onSubmit: () => void;
}) {
  const creditedTeam = scoringTeamId === away.id ? away : home;
  const playerTeam = goalType === "normal" ? creditedTeam : creditedTeam.id === home.id ? away : home;
  const canSave = !saving && (goalType === "own_goal" || selectedPlayerId !== "");

  return (
    <Drawer
      open={open}
      title={editing ? "Edit goal" : "Record a goal"}
      description="Choose the team receiving the goal, then identify the scorer."
      onClose={onClose}
    >
      <form className="grid gap-6" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <section>
          <p className="mb-2 text-sm font-semibold text-fg">Team credited</p>
          <div className="grid grid-cols-2 gap-3">
            {[home, away].map((team) => {
              const selected = scoringTeamId === team.id;
              return (
                <button
                  key={team.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onScoringTeamChange(team.id)}
                  className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-accent bg-accent/10 ring-1 ring-accent/30" : "border-line bg-surface hover:border-accent/50"}`}
                >
                  <Avatar name={team.name} asset={team.logo} className="h-11 w-11 shrink-0 rounded-lg" />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">{team.id === home.id ? "Home" : "Away"}</span>
                    <span className="block truncate text-sm font-semibold text-fg">{team.name}</span>
                  </span>
                  {selected ? <span className="ml-auto text-accent">✓</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="mb-2 text-sm font-semibold text-fg">Goal type</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: "normal" as const, label: "Normal goal", hint: "Scored for the team", symbol: "⚽" },
              { value: "own_goal" as const, label: "Own goal", hint: "Credited to opponent", symbol: "↗" },
            ]).map((option) => {
              const selected = goalType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onGoalTypeChange(option.value)}
                  className={`rounded-xl border p-3 text-left transition ${selected ? "border-accent bg-accent/10 ring-1 ring-accent/30" : "border-line bg-surface hover:border-accent/50"}`}
                >
                  <span className="text-xl">{option.symbol}</span>
                  <span className="mt-2 block text-sm font-semibold text-fg">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-fg">{goalType === "own_goal" ? "Opposing player" : "Goal scorer"}</p>
            <span className="text-xs text-muted">{playerTeam.name}</span>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {goalType === "own_goal" ? (
              <button
                type="button"
                aria-pressed={selectedPlayerId === ""}
                onClick={() => onPlayerChange("")}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selectedPlayerId === "" ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-accent/50"}`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-lg text-muted">?</span>
                <span className="text-sm font-medium text-fg">Player not recorded</span>
                {selectedPlayerId === "" ? <span className="ml-auto text-accent">✓</span> : null}
              </button>
            ) : null}
            {players.length ? players.map((player) => {
              const selected = selectedPlayerId === player.id;
              return (
                <button
                  key={player.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPlayerChange(player.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${selected ? "border-accent bg-accent/10 ring-1 ring-accent/20" : "border-line bg-surface hover:border-accent/50"}`}
                >
                  <Avatar name={player.name} asset={player.profilePic} className="h-10 w-10 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{player.name}</span>
                  <span className="rounded-lg bg-glass-strong px-2.5 py-1 text-xs font-bold tabular-nums text-muted">#{player.jerseyNo ?? "—"}</span>
                  {selected ? <span className="text-accent">✓</span> : null}
                </button>
              );
            }) : (
              <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">No eligible players found for {playerTeam.name}.</p>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">
            {goalType === "own_goal"
              ? "Select a player from the opposing team. The goal will be credited to the selected team."
              : "Only players registered to the credited team are shown."}
          </p>
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        </section>

        <div className="flex gap-2 border-t border-line pt-4">
          <Button type="button" variant="surface" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={!canSave}>{saving ? "Saving…" : editing ? "Save changes" : "Save goal"}</Button>
        </div>
      </form>
    </Drawer>
  );
}
