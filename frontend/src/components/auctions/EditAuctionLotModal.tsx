import type { FormEvent, ReactNode } from "react";
import { Check, ShieldCheck, Sparkles } from "lucide-react";
import { AuctionLotPreview } from "@/components/auctions/AuctionLotPreview";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import type { Asset } from "@/types/api.types";
import type { AuctionLot, AuctionLotStatus, AuctionTeamSummary, AuctionLifecycleStatus, SeasonPlayerPosition } from "@/types/season.types";

interface EditAuctionLotModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  lot: AuctionLot | null;
  playerName: string;
  playerImage: Asset | null;
  lifecycleStatus: AuctionLifecycleStatus;
  statuses: AuctionLotStatus[];
  positions: Record<SeasonPlayerPosition, string>;
  editStatus: AuctionLotStatus;
  onStatusChange: (value: AuctionLotStatus) => void;
  editPosition: SeasonPlayerPosition | "";
  onPositionChange: (value: SeasonPlayerPosition | "") => void;
  editIconPlayer: boolean;
  onIconPlayerChange: (value: boolean) => void;
  editGoalkeeper: boolean;
  onGoalkeeperChange: (value: boolean) => void;
  teams: AuctionTeamSummary[];
  teamSquadSize: number;
  goalkeeperLimit: number;
  iconPlayerLimit: number;
  editTeamId: string;
  onTeamChange: (value: string) => void;
  editPrice: string;
  onPriceChange: (value: string) => void;
  editJersey: string;
  onJerseyChange: (value: string) => void;
  selectedTeam: AuctionTeamSummary | null;
  estimatedBalance: number | null;
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
    <label className={"flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition " +
      (checked ? "border-accent/60 bg-accent/10" : "border-line bg-glass hover:border-accent/40")}>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
        (checked ? "bg-accent/15 text-accent" : "bg-surface text-muted")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>
      </span>
      <span className={"flex h-5 w-5 shrink-0 items-center justify-center rounded-full border " +
        (checked ? "border-accent bg-accent text-accent-fg" : "border-line text-transparent")}>
        <Check className="h-3 w-3" />
      </span>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "active" || status === "registered" ? "bg-success/10 text-success" :
    status === "withdrawn" ? "bg-warning/10 text-warning" :
    "bg-surface text-muted";
  return <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize " + classes}>{status}</span>;
}

export function EditAuctionLotModal({
  open,
  onClose,
  onSubmit,
  lot,
  playerName,
  playerImage,
  lifecycleStatus,
  statuses,
  positions,
  editStatus,
  onStatusChange,
  editPosition,
  onPositionChange,
  editIconPlayer,
  onIconPlayerChange,
  editGoalkeeper,
  onGoalkeeperChange,
  teams,
  teamSquadSize,
  goalkeeperLimit,
  iconPlayerLimit,
  editTeamId,
  onTeamChange,
  editPrice,
  onPriceChange,
  editJersey,
  onJerseyChange,
  selectedTeam,
  estimatedBalance,
  saving,
}: EditAuctionLotModalProps) {
  const statusGuidance = lifecycleStatus === "not_started"
    ? "Auction not started: lots must remain Pending. Status changes and sale assignments become available once the auction is In Progress."
    : lifecycleStatus === "in_progress"
      ? "Auction In Progress: you can update lot status and record or change the winning team. Sold requires a team and purchase price; Withdrawn is available only for a previously sold lot."
      : "Auction completed: lot details are locked. Reopen the auction to make further changes.";

  return (
    <Modal
      open={open}
      title="Edit auction lot"
      description="Update the player’s auction classification and sale details. Existing roster, budget and quota rules still apply."
      onClose={onClose}
    >
      <form className="grid gap-5" onSubmit={onSubmit}>
        {lot ? (
          <AuctionLotPreview
            playerName={playerName}
            playerImage={playerImage}
            status={editStatus}
            lotNumber={lot.lotNumber}
            positionLabel={editPosition ? positions[editPosition] : "Not selected"}
            teamName={editStatus === "sold" ? selectedTeam?.displayName ?? null : null}
            teamLogo={editStatus === "sold" ? selectedTeam?.logoSnapshot ?? null : null}
            jerseyNo={editStatus === "sold" ? editJersey : null}
            iconPlayer={editIconPlayer}
            goalkeeper={editGoalkeeper}
            price={editStatus === "sold" ? editPrice : null}
            pricePlaceholder={editStatus === "sold" ? "Enter purchase price" : "Not sold"}
          />
        ) : null}

        <section className="rounded-2xl border border-line bg-surface/40 p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-accent">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-fg">Player classification</h3>
              <p className="text-xs text-muted">Choose the season position and player designations.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <Field label="Season position">
              <Select required value={editPosition} onChange={(event) => onPositionChange(event.target.value as SeasonPlayerPosition | "")}>
                <option value="">Select position</option>
                {Object.entries(positions).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-2">
              <ToggleCard
                checked={editIconPlayer}
                onChange={onIconPlayerChange}
                title="Icon player"
                description="Uses one of the season’s Icon Player slots."
                icon={<Sparkles className="h-4 w-4" />}
              />
              <ToggleCard
                checked={editGoalkeeper}
                onChange={onGoalkeeperChange}
                title="Goalkeeper"
                description="Sets the player position to Goalkeeper."
                icon={<ShieldCheck className="h-4 w-4" />}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface/40 p-3 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-fg">Auction status</h3>
            <StatusBadge status={editStatus} />
          </div>
          <Select value={editStatus} onChange={(event) => onStatusChange(event.target.value as AuctionLotStatus)}>
            {statuses.map((status) => (
              <option
                key={status}
                value={status}
                disabled={
                  lot?.auctionStatus === "withdrawn"
                  || (status === "withdrawn" && lot?.auctionStatus !== "sold")
                  || (lifecycleStatus === "not_started" && status !== "pending")
                }
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </Select>
          <p className="mt-2 text-xs leading-relaxed text-muted">{statusGuidance}</p>
        </section>

        {editStatus === "sold" ? (
          <>
            <section className="rounded-2xl border border-line bg-surface/40 p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-fg">Winning team</h3>
                  <p className="mt-0.5 text-xs text-muted">Choose the team that purchased this player.</p>
                </div>
                <span className="rounded-full border border-line bg-glass px-2.5 py-1 text-[10px] font-semibold text-muted">
                  {teams.filter((team) => !["withdrawn", "eliminated", "completed"].includes(team.status)).length} eligible
                </span>
              </div>

              {teams.length ? (
                <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {teams.map((team) => {
                    const selected = editTeamId === team.seasonTeamId;
                    const disabled = ["withdrawn", "eliminated", "completed"].includes(team.status);
                    const remainingPlayers = Math.max(teamSquadSize - team.playersSigned, 0);
                    const remainingGoalkeepers = Math.max(goalkeeperLimit - team.goalkeeperCount, 0);
                    const remainingIconPlayers = Math.max(iconPlayerLimit - team.iconCount, 0);
                    return (
                      <button
                        key={team.seasonTeamId}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={disabled}
                        onClick={() => onTeamChange(team.seasonTeamId)}
                        className={"flex min-w-0 items-center gap-2.5 rounded-xl border p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-45 " +
                          (selected ? "border-accent bg-accent/10 shadow-sm" : "border-line bg-glass hover:border-accent/40 hover:bg-surface")}
                      >
                        <Avatar name={team.displayName} asset={team.logoSnapshot} className="h-11 w-11 shrink-0 rounded-xl border border-line" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-fg">{team.displayName}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-muted">Balance · ₹{team.balance.toLocaleString("en-IN")}</span>
                          <span className="mt-2 grid grid-cols-3 gap-1.5">
                            <span className="min-w-0 rounded-lg border border-line/70 bg-surface/60 px-1.5 py-1">
                              <span className="block truncate text-[9px] leading-tight text-muted">Players left</span>
                              <span className="mt-0.5 block text-xs font-semibold tabular text-fg">{remainingPlayers}<span className="text-[9px] font-normal text-muted">/{teamSquadSize}</span></span>
                            </span>
                            <span className="min-w-0 rounded-lg border border-line/70 bg-surface/60 px-1.5 py-1">
                              <span className="block truncate text-[9px] leading-tight text-muted">Goalkeepers left</span>
                              <span className="mt-0.5 block text-xs font-semibold tabular text-fg">{remainingGoalkeepers}<span className="text-[9px] font-normal text-muted">/{goalkeeperLimit}</span></span>
                            </span>
                            <span className="min-w-0 rounded-lg border border-line/70 bg-surface/60 px-1.5 py-1">
                              <span className="block truncate text-[9px] leading-tight text-muted">Icon players left</span>
                              <span className="mt-0.5 block text-xs font-semibold tabular text-fg">{remainingIconPlayers}<span className="text-[9px] font-normal text-muted">/{iconPlayerLimit}</span></span>
                            </span>
                          </span>
                          <span className="mt-1.5 block"><StatusBadge status={team.status} /></span>
                        </span>
                        <span className={"flex h-5 w-5 shrink-0 items-center justify-center rounded-full border " +
                          (selected ? "border-accent bg-accent text-accent-fg" : "border-line text-transparent")}>
                          <Check className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">
                  No participating teams are available for this season.
                </p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Team assignment and changes are available while the auction is In Progress. Withdrawn, eliminated and completed teams cannot receive a player.
              </p>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Purchase Price (INR)">
                <Input className="h-12 text-base" type="number" min="0" step="1" required value={editPrice} onChange={(event) => onPriceChange(event.target.value)} placeholder="Enter purchase price" />
              </Field>
              <Field label="Jersey Number (optional)">
                <Input className="h-12 text-base" type="number" min="1" max="99" value={editJersey} onChange={(event) => onJerseyChange(event.target.value)} placeholder="e.g. 10" />
              </Field>
            </div>

            {selectedTeam && estimatedBalance !== null ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-glass p-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted">Estimated balance after purchase</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-fg">{selectedTeam.displayName}</p>
                </div>
                <p className="shrink-0 text-lg font-semibold tabular text-fg">₹{estimatedBalance.toLocaleString("en-IN")}</p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-line bg-surface/50 p-3 text-xs leading-relaxed text-muted">
            Withdrawn players retain their original team and sale details as history. Sold players can return to Pending or Unsold only if their team has no fixtures.
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="surface" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !editPosition || (editStatus === "sold" && (!editTeamId || editPrice.trim() === ""))}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
