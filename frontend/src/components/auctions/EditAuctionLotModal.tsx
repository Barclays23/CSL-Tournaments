
import type { FormEvent, ReactNode } from "react";
import { Check, Gavel, ShieldCheck, Sparkles, Trophy } from "lucide-react";

import { AuctionLotPreview } from "@/components/auctions/AuctionLotPreview";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

import { TONES, ToneSection, type Tone } from "@/lib/tones/Tones";

import type { Asset } from "@/types/api.types";
import type {
  AuctionLot,
  AuctionLotStatus,
  AuctionTeamSummary,
  AuctionLifecycleStatus,
  SeasonPlayerPosition,
} from "@/types/season.types";

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

/* -------------------------------------------------------------------------- */
/*                                    Fields                                  */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  tone,
  children,
}: {
  label: string;
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-fg">
      <span
        className={
          "mb-1.5 block font-semibold " + TONES[tone].text
        }
      >
        {label}
      </span>
      {children}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Toggle Card                               */
/* -------------------------------------------------------------------------- */

function ToggleCard({
  checked,
  onChange,
  title,
  description,
  icon,
  tone,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
  icon: ReactNode;
  tone: Tone;
}) {
  const t = TONES[tone];

  return (
    <label
      className={
        "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition " +
        (checked ? t.cardOn : t.cardOff)
      }
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />

      <span
        className={
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
          (checked ? t.chipOn : t.chip)
        }
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">
          {description}
        </span>
      </span>

      <span
        className={
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border " +
          (checked ? t.checkOn : "border-line text-transparent")
        }
      >
        <Check className="h-3 w-3" />
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Count Tile                               */
/* -------------------------------------------------------------------------- */

function CountTile({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "primary" | "info" | "gold";
}) {
  const t = TONES[tone];

  return (
    <div
      className={
        "flex min-w-0 flex-col overflow-hidden rounded-lg border " +
        t.section
      }
    >
      <div
        className={
          "flex min-h-[2rem] items-center justify-center border-b px-1 py-0.5 text-center " +
          t.chip
        }
      >
        <span className="text-[10px] font-semibold leading-tight">
          {label}
        </span>
      </div>

      <div className="flex flex-1 items-baseline justify-center gap-0.5 px-1.5 py-1.5">
        <span className="text-xl font-bold leading-none tabular text-fg">
          {value}
        </span>
        <span className="text-[11px] font-medium text-muted">
          /{total}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Status Badge                              */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "active" || status === "registered"
      ? "bg-success/10 text-success"
      : status === "withdrawn"
        ? "bg-warning/10 text-warning"
        : "bg-surface text-muted";

  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize " +
        classes
      }
    >
      {status}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*                           Edit Auction Lot Modal                           */
/* -------------------------------------------------------------------------- */

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
  const statusGuidance =
    lifecycleStatus === "not_started"
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
        {/* Player Preview */}
        {lot ? (
          <AuctionLotPreview
            playerName={playerName}
            playerImage={playerImage}
            status={editStatus}
            lotNumber={lot.lotNumber}
            positionLabel={
              editPosition ? positions[editPosition] : "Not selected"
            }
            teamName={
              editStatus === "sold"
                ? selectedTeam?.displayName ?? null
                : null
            }
            teamLogo={
              editStatus === "sold"
                ? selectedTeam?.logoSnapshot ?? null
                : null
            }
            jerseyNo={editStatus === "sold" ? editJersey : null}
            iconPlayer={editIconPlayer}
            goalkeeper={editGoalkeeper}
            price={editStatus === "sold" ? editPrice : null}
            pricePlaceholder={
              editStatus === "sold" ? "Enter purchase price" : "Not sold"
            }
          />
        ) : null}

        {/* Player Classification */}
        <ToneSection
          tone="info"
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Player classification"
          description="Choose the season position and player designations."
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <Field label="Season position" tone="info">
              <Select
                className={TONES.info.input}
                required
                value={editPosition}
                onChange={(event) =>
                  onPositionChange(
                    event.target.value as SeasonPlayerPosition | ""
                  )
                }
              >
                <option value="" className="bg-surface text-muted">
                  Select position
                </option>

                {Object.entries(positions).map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                    className="bg-surface text-fg"
                  >
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-2">
              <ToggleCard
                tone="gold"
                checked={editIconPlayer}
                onChange={onIconPlayerChange}
                title="Icon player"
                description="Uses one of the season’s Icon Player slots."
                icon={<Sparkles className="h-4 w-4" />}
              />

              <ToggleCard
                tone="info"
                checked={editGoalkeeper}
                onChange={onGoalkeeperChange}
                title="Goalkeeper"
                description="Sets the player position to Goalkeeper."
                icon={<ShieldCheck className="h-4 w-4" />}
              />
            </div>
          </div>
        </ToneSection>

        {/* Auction Status */}
        <ToneSection
          tone="gold"
          icon={<Gavel className="h-4 w-4" />}
          title="Auction status"
        >
          <div className="grid gap-2">
            <div className="flex justify-end">
              <StatusBadge status={editStatus} />
            </div>

            <Select
              className={TONES.gold.input}
              value={editStatus}
              onChange={(event) =>
                onStatusChange(event.target.value as AuctionLotStatus)
              }
            >
              {statuses.map((status) => (
                <option
                  key={status}
                  value={status}
                  className="bg-surface text-fg disabled:text-faint"
                  disabled={
                    lot?.auctionStatus === "withdrawn" ||
                    (status === "withdrawn" &&
                      lot?.auctionStatus !== "sold") ||
                    (lifecycleStatus === "not_started" &&
                      status !== "pending")
                  }
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </Select>

            <p className="text-xs leading-relaxed text-muted">
              {statusGuidance}
            </p>
          </div>
        </ToneSection>

        {editStatus === "sold" ? (
          <>
            {/* Winning Team */}
            <ToneSection
              tone="primary"
              icon={<Trophy className="h-4 w-4" />}
              title="Winning team"
              description="Choose the team that purchased this player."
            >
              <div className="flex justify-end">
                <span className="rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-[10px] font-semibold text-success">
                  {
                    teams.filter(
                      (team) =>
                        ![
                          "withdrawn",
                          "eliminated",
                          "completed",
                        ].includes(team.status)
                    ).length
                  }{" "}
                  eligible
                </span>
              </div>

              {teams.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {teams.map((team) => {
                    const selected =
                      editTeamId === team.seasonTeamId;

                    const disabled = [
                      "withdrawn",
                      "eliminated",
                      "completed",
                    ].includes(team.status);

                    const remainingPlayers = Math.max(
                      teamSquadSize - team.playersSigned,
                      0
                    );

                    const remainingGoalkeepers = Math.max(
                      goalkeeperLimit - team.goalkeeperCount,
                      0
                    );

                    const remainingIconPlayers = Math.max(
                      iconPlayerLimit - team.iconCount,
                      0
                    );

                    return (
                      <button
                        key={team.seasonTeamId}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={disabled}
                        onClick={() =>
                          onTeamChange(team.seasonTeamId)
                        }
                        className={
                          "flex min-w-0 flex-col gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 " +
                          (selected
                            ? "border-accent bg-accent/15 shadow-sm ring-1 ring-accent/40"
                            : "border-primary/30 bg-glass hover:border-accent/50 hover:bg-surface")
                        }
                      >
                        {/* Team Logo + Name */}
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={team.displayName}
                            asset={team.logoSnapshot}
                            className="h-11 w-11 shrink-0 rounded-xl border border-line"
                          />

                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                            {team.displayName}
                          </span>

                          <span
                            className={
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border " +
                              (selected
                                ? "border-accent bg-accent text-accent-fg"
                                : "border-line text-transparent")
                            }
                          >
                            <Check className="h-3 w-3" />
                          </span>
                        </div>

                        {/* Team Balance */}
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5">
                          <span className="text-[11px] text-success">
                            Balance
                          </span>

                          <span className="text-sm font-semibold tabular text-fg">
                            ₹{team.balance.toLocaleString("en-IN")}
                          </span>
                        </div>

                        {/* Remaining Quotas */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <CountTile
                            label="Players left"
                            value={remainingPlayers}
                            total={teamSquadSize}
                            tone="primary"
                          />

                          <CountTile
                            label="Goalkeepers left"
                            value={remainingGoalkeepers}
                            total={goalkeeperLimit}
                            tone="info"
                          />

                          <CountTile
                            label="Icon players left"
                            value={remainingIconPlayers}
                            total={iconPlayerLimit}
                            tone="gold"
                          />
                        </div>

                        {/* Team Status */}
                        <div>
                          <StatusBadge status={team.status} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">
                  No participating teams are available for this season.
                </p>
              )}

              <p className="text-xs leading-relaxed text-muted">
                Team assignment and changes are available while the
                auction is In Progress. Withdrawn, eliminated and
                completed teams cannot receive a player.
              </p>
            </ToneSection>

            {/* Purchase Price + Jersey Number */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div
                className={
                  "rounded-2xl border p-3 " + TONES.gold.section
                }
              >
                <Field label="Purchase Price (INR)" tone="gold">
                  <Input
                    className={"h-12 text-base " + TONES.gold.input}
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={editPrice}
                    onChange={(event) =>
                      onPriceChange(event.target.value)
                    }
                    placeholder="Enter purchase price"
                  />
                </Field>
              </div>

              <div
                className={
                  "rounded-2xl border p-3 " + TONES.info.section
                }
              >
                <Field label="Jersey Number (optional)" tone="info">
                  <Input
                    className={"h-12 text-base " + TONES.info.input}
                    type="number"
                    min="1"
                    max="99"
                    value={editJersey}
                    onChange={(event) =>
                      onJerseyChange(event.target.value)
                    }
                    placeholder="e.g. 10"
                  />
                </Field>
              </div>
            </div>

            {/* Estimated Balance */}
            {selectedTeam && estimatedBalance !== null ? (
              <div
                className={
                  "flex items-center justify-between gap-3 rounded-2xl border p-3 " +
                  TONES.success.section
                }
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-success">
                    Estimated balance after purchase
                  </p>

                  <p className="mt-0.5 truncate text-sm font-semibold text-fg">
                    {selectedTeam.displayName}
                  </p>
                </div>

                <p className="shrink-0 text-lg font-semibold tabular text-success">
                  ₹{estimatedBalance.toLocaleString("en-IN")}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-line bg-surface/50 p-3 text-xs leading-relaxed text-muted">
            Withdrawn players retain their original team and sale
            details as history. Sold players can return to Pending or
            Unsold only if their team has no fixtures.
          </div>
        )}

        {/* Form Actions */}
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="surface"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={
              saving ||
              !editPosition ||
              (editStatus === "sold" &&
                (!editTeamId || editPrice.trim() === ""))
            }
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
