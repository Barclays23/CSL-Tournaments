import type { FormEvent, ReactNode } from "react";
import { Check, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import type { PublicPlayer } from "@/types/player.types";
import type { SeasonPlayerPosition } from "@/types/season.types";

interface CreateAuctionLotModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  availablePlayers: PublicPlayer[];
  totalActivePlayers: number;
  playersError?: string | null;
  playerSearch: string;
  onPlayerSearchChange: (value: string) => void;
  playerId: string;
  onPlayerSelect: (value: string) => void;
  playerPosition: SeasonPlayerPosition | "";
  onPlayerPositionChange: (value: SeasonPlayerPosition | "") => void;
  isIconPlayer: boolean;
  onIconPlayerChange: (value: boolean) => void;
  isGoalkeeper: boolean;
  onGoalkeeperChange: (value: boolean) => void;
  positions: Record<SeasonPlayerPosition, string>;
  nominatedIconCount: number;
  iconQuotaLimit: number;
  iconPlayerLimit: number;
  nominatedGoalkeeperCount: number;
  goalkeeperQuotaLimit: number;
  goalkeeperLimit: number;
  teamRegistrationLimit: number;
  saving: boolean;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-fg">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function ToggleCard({
  checked,
  onChange,
  title,
  description,
  icon,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition " +
      (checked ? "border-accent/60 bg-accent/10" : "border-line bg-glass hover:border-accent/40")}>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={"mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
        (checked ? "bg-accent/15 text-accent" : "bg-surface text-muted")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>
      </span>
      <span className={"mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border " +
        (checked ? "border-accent bg-accent text-accent-fg" : "border-line text-transparent")}>
        <Check className="h-3 w-3" />
      </span>
    </label>
  );
}

export function CreateAuctionLotModal({
  open,
  onClose,
  onSubmit,
  availablePlayers,
  totalActivePlayers,
  playersError,
  playerSearch,
  onPlayerSearchChange,
  playerId,
  onPlayerSelect,
  playerPosition,
  onPlayerPositionChange,
  isIconPlayer,
  onIconPlayerChange,
  isGoalkeeper,
  onGoalkeeperChange,
  positions,
  nominatedIconCount,
  iconQuotaLimit,
  iconPlayerLimit,
  nominatedGoalkeeperCount,
  goalkeeperQuotaLimit,
  goalkeeperLimit,
  teamRegistrationLimit,
  saving,
}: CreateAuctionLotModalProps) {
  return (
    <Modal
      open={open}
      title="Create auction lot"
      description="Nominate an active player and prepare their auction details."
      onClose={onClose}
    >
      <form className="grid gap-5" onSubmit={onSubmit}>
        <section className="rounded-2xl border border-line bg-surface/40 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-fg">Choose a player</h3>
              <p className="mt-0.5 text-xs text-muted">Select one active player to add to this season’s auction.</p>
            </div>
            <span className="rounded-full border border-line bg-glass px-2.5 py-1 text-xs font-semibold tabular text-muted">
              {availablePlayers.length} available
            </span>
          </div>

          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              aria-label="Search available players"
              className="pl-9"
              placeholder="Search players by name…"
              value={playerSearch}
              onChange={(event) => onPlayerSearchChange(event.target.value)}
            />
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {availablePlayers.map((player) => {
              const selected = playerId === player._id;
              return (
                <button
                  type="button"
                  key={player._id}
                  onClick={() => onPlayerSelect(player._id)}
                  aria-pressed={selected}
                  className={"flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition " +
                    (selected ? "border-accent bg-accent/10 shadow-sm" : "border-line bg-glass hover:border-accent/40 hover:bg-surface")}
                >
                  <Avatar name={player.name} asset={player.profilePic} className="h-11 w-11 shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">{player.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">Active player</span>
                  </span>
                  <span className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-full border " +
                    (selected ? "border-accent bg-accent text-accent-fg" : "border-line text-transparent")}>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}
            {!availablePlayers.length ? (
              <div className="rounded-xl border border-dashed border-line px-4 py-7 text-center">
                <p className="text-sm font-medium text-fg">
                  {totalActivePlayers ? "No available players match this search." : "No active players are available."}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {totalActivePlayers ? "Try another player name." : "Activate or add player profiles before creating auction lots."}
                </p>
              </div>
            ) : null}
          </div>
          {playersError ? <p className="mt-2 text-xs text-danger">{playersError}</p> : null}
        </section>

        <section className="rounded-2xl border border-line bg-surface/40 p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-accent">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-fg">Player classification</h3>
              <p className="text-xs text-muted">Set the playing position and optional designations.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <Field label="Season position">
              <Select
                required
                value={playerPosition}
                onChange={(event) => onPlayerPositionChange(event.target.value as SeasonPlayerPosition | "")}
              >
                <option value="">Select position</option>
                {Object.entries(positions).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-2">
              <ToggleCard
                checked={isIconPlayer}
                onChange={onIconPlayerChange}
                title="Icon player"
                description="Counts towards the season Icon Player quota."
                icon={<Sparkles className="h-4 w-4" />}
              />
              <ToggleCard
                checked={isGoalkeeper}
                onChange={onGoalkeeperChange}
                title="Goalkeeper"
                description="Uses the Goalkeeper position and quota."
                icon={<ShieldCheck className="h-4 w-4" />}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-2 rounded-2xl border border-line bg-glass p-3 sm:grid-cols-2 sm:p-4">
          <div>
            <p className="text-xs font-medium text-muted">Season Icon Player quota</p>
            <p className="mt-1 text-lg font-semibold tabular text-fg">{nominatedIconCount}<span className="text-sm text-muted"> / {iconQuotaLimit}</span></p>
            <p className="text-[11px] text-muted">{iconPlayerLimit} per team × {teamRegistrationLimit} teams</p>
          </div>
          <div className="border-t border-line pt-2 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <p className="text-xs font-medium text-muted">Season Goalkeeper quota</p>
            <p className="mt-1 text-lg font-semibold tabular text-fg">{nominatedGoalkeeperCount}<span className="text-sm text-muted"> / {goalkeeperQuotaLimit}</span></p>
            <p className="text-[11px] text-muted">{goalkeeperLimit} per team × {teamRegistrationLimit} teams</p>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="surface" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !playerId || !playerPosition}>
            {saving ? "Saving…" : "Create auction lot"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
