import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import type { SeasonMatchCardType } from "@/types/seasonMatch.types";
type Team = { id: string; name: string };
type Player = { id: string; name: string; jerseyNo: number | null };
const options: Array<{ value: SeasonMatchCardType; label: string }> = [
  { value: "yellow_card", label: "Yellow card" }, { value: "red_card", label: "Red card" }, { value: "second_yellow", label: "Second yellow card" },
];
export function CardManagementDrawer({ open, onClose, editing, home, away, teamId, onTeamChange, cardType, onCardTypeChange, playerId, onPlayerChange, players, saving, error, onSubmit }: {
  open: boolean; onClose: () => void; editing: boolean; home: Team; away: Team; teamId: string; onTeamChange: (id: string) => void;
  cardType: SeasonMatchCardType; onCardTypeChange: (type: SeasonMatchCardType) => void; playerId: string; onPlayerChange: (id: string) => void;
  players: Player[]; saving: boolean; error?: string | null; onSubmit: () => void;
}) {
  return <Drawer open={open} title={editing ? "Edit card" : "Record a card"} description="Choose the team, player and card decision." onClose={onClose}>
    <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <label className="grid gap-1.5 text-sm font-semibold text-fg">Team<select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={teamId} onChange={(event) => { onTeamChange(event.target.value); onPlayerChange(""); }}><option value={home.id}>{home.name}</option><option value={away.id}>{away.name}</option></select></label>
      <label className="grid gap-1.5 text-sm font-semibold text-fg">Card<select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={cardType} onChange={(event) => onCardTypeChange(event.target.value as SeasonMatchCardType)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="grid gap-1.5 text-sm font-semibold text-fg">Player<select required className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={playerId} onChange={(event) => onPlayerChange(event.target.value)}><option value="">Select a player</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}{player.jerseyNo ? ` · #${player.jerseyNo}` : ""}</option>)}</select></label>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex gap-2 border-t border-line pt-4"><Button type="button" variant="surface" className="flex-1" onClick={onClose}>Cancel</Button><Button type="submit" className="flex-1" disabled={saving || !playerId}>{saving ? "Saving…" : editing ? "Save changes" : "Record card"}</Button></div>
    </form>
  </Drawer>;
}