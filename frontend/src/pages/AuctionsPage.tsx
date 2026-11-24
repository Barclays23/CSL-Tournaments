import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminPageBanner } from "@/components/admin/AdminPageBanner";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { useConfirm } from "@/contexts/ConfirmContext";
import {
  getSeasons,
  getAuctionSummary,
  getAuctionLots,
  startSeasonAuction,
  completeSeasonAuction,
  reopenSeasonAuction,
  deletePendingAuctionLot,
  nominatePlayer,
  updateAuctionLot,
} from "@/services/seasonService";
import { getPlayers } from "@/services/playerService";
import type { AuctionLot, AuctionLotStatus, SeasonPlayerPosition } from "@/types/season.types";
import type { ApiResponse } from "@/types/api.types";
import type { AdminPlayer, PublicPlayer } from "@/types/player.types";
import { formatCurrency } from "@/utils/formatCurrency";
import { errorMessage } from "@/utils/errorHandler";
import { getDefaultSeason } from "@/utils/defaultSeason";

const EMPTY_LOTS: ApiResponse<AuctionLot[]> = { success: true, message: "", data: [] };
const EMPTY_SUMMARY: ApiResponse<null> = { success: true, message: "", data: null };
const POSITIONS: Record<SeasonPlayerPosition, string> = {
  goalkeeper: "Goalkeeper",
  defender: "Defender",
  midfielder: "Midfielder",
  forward: "Forward",
};
const LOT_STATUSES: AuctionLotStatus[] = ["pending", "sold", "unsold", "withdrawn"];

/* Static class strings so Tailwind can see them. All colours are theme tokens. */
const STATUS_PILL: Record<AuctionLotStatus, string> = {
  pending: "bg-info/15 text-info",
  sold: "bg-success/15 text-success",
  unsold: "bg-surface text-muted",
  withdrawn: "bg-warning/15 text-warning",
};
const STATUS_EDGE: Record<AuctionLotStatus, string> = {
  pending: "border-l-info",
  sold: "border-l-success",
  unsold: "border-l-faint",
  withdrawn: "border-l-warning",
};

/* ------------------------------------------------------------------ */
/* Small building blocks                                              */
/* ------------------------------------------------------------------ */

function Pill({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <span className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize " + className}>
      {children}
    </span>
  );
}

function SectionTitle({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="h-7 w-1.5 rounded-full bg-linear-to-b from-accent to-primary" />
        <h2 className="font-display text-2xl text-fg">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface" role="presentation">
      <div className="h-full rounded-full bg-linear-to-r from-primary to-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}

function StatTile({ label, value, current, limit }: { label: string; value: string | number; current?: number; limit?: number }) {
  return (
    <div className="rounded-2xl border border-line bg-glass p-4 shadow-glass backdrop-blur-xl">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1.5 font-display text-2xl tabular text-fg">{value}</p>
      {limit !== undefined && current !== undefined ? (
        <div className="mt-3"><ProgressBar value={current} max={limit} /></div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-fg">
      {label}
      <div className="mt-1 font-normal">{children}</div>
    </label>
  );
}

function CheckField({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-glass px-3 py-2.5 text-sm text-fg">
      <input
        type="checkbox"
        className="h-4 w-4 accent-accent"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function AuctionsPage() {
  const isAdmin = true;
  const confirm = useConfirm();
  const seasons = useServiceQuery(() => getSeasons(), []);
  const [seasonId, setSeasonId] = useState("");
  const defaultSeasonId = useMemo(
    () => getDefaultSeason(seasons.data?.data ?? [])?._id ?? "",
    [seasons.data],
  );
  const selectedSeasonId = seasonId || defaultSeasonId;

  const [playerSearch, setPlayerSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<AuctionLotStatus | "">("");
  const [positionFilter, setPositionFilter] = useState<SeasonPlayerPosition | "">("");
  const [playerName, setPlayerName] = useState("");
  const [iconFilter, setIconFilter] = useState("");
  const [goalkeeperFilter, setGoalkeeperFilter] = useState("");
  const summary = useServiceQuery(
    () => selectedSeasonId
      ? getAuctionSummary(selectedSeasonId)
      : Promise.resolve(EMPTY_SUMMARY as unknown as Awaited<ReturnType<typeof getAuctionSummary>>),
    [selectedSeasonId],
  );
  const lots = useServiceQuery(
    () => selectedSeasonId
      ? getAuctionLots({
          seasonId: selectedSeasonId,
          ...(teamFilter ? { seasonTeamId: teamFilter } : {}),
          ...(statusFilter ? { auctionStatus: statusFilter } : {}),
          ...(positionFilter ? { playerPosition: positionFilter } : {}),
          ...(playerName.trim() ? { playerName: playerName.trim() } : {}),
          ...(iconFilter ? { isIconPlayer: iconFilter === "true" } : {}),
          ...(goalkeeperFilter ? { isGoalkeeper: goalkeeperFilter === "true" } : {}),
        })
      : Promise.resolve(EMPTY_LOTS),
    [selectedSeasonId, teamFilter, statusFilter, positionFilter, playerName, iconFilter, goalkeeperFilter],
  );
  const players = useServiceQuery(() => getPlayers({ limit: 100, status: "active" }), []);

  const data = summary.data?.data;
  const selectedSeason = seasons.data?.data.find((season) => season._id === selectedSeasonId) ?? null;
  const lotRows = lots.data?.data ?? [];
  const nominatedLots = (data?.lots ?? []).filter((lot) => lot.auctionStatus !== "withdrawn");
  const registeredTeamCount = (data?.teams ?? []).filter((team) => team.status === "registered" || team.status === "active").length;
  const teamRegistrationLimit = data?.season.auctionSettings.seasonTeamCount ?? 0;
  const playerNominationLimit = data?.season.auctionSettings.playersCount ?? 0;
  const iconQuotaLimit = teamRegistrationLimit * (data?.season.auctionSettings.iconPlayerLimit ?? 0);
  const goalkeeperQuotaLimit = teamRegistrationLimit * (data?.season.auctionSettings.goalkeeperLimit ?? 0);
  const nominatedIconCount = nominatedLots.filter((lot) => lot.isIconPlayer).length;
  const nominatedGoalkeeperCount = nominatedLots.filter((lot) => lot.isGoalkeeper).length;

  const playerRows = (players.data?.data ?? []) as Array<PublicPlayer | AdminPlayer>;
  const nominatedPlayerIds = new Set((data?.lots ?? []).map((lot) => typeof lot.playerRef === "string" ? lot.playerRef : lot.playerRef._id));
  const availablePlayers = playerRows.filter((player) => !nominatedPlayerIds.has(player._id) && (!playerSearch.trim() || player.name.toLowerCase().includes(playerSearch.trim().toLowerCase())));

  const [nominateOpen, setNominateOpen] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [playerPosition, setPlayerPosition] = useState<SeasonPlayerPosition | "">("");
  const [isIconPlayer, setIsIconPlayer] = useState(false);
  const [isGoalkeeper, setIsGoalkeeper] = useState(false);

  const [editingLot, setEditingLot] = useState<AuctionLot | null>(null);
  const [editStatus, setEditStatus] = useState<AuctionLotStatus>("pending");
  const [editPosition, setEditPosition] = useState<SeasonPlayerPosition>("midfielder");
  const [editIconPlayer, setEditIconPlayer] = useState(false);
  const [editGoalkeeper, setEditGoalkeeper] = useState(false);
  const [editTeamId, setEditTeamId] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editJersey, setEditJersey] = useState("");
  const [saving, setSaving] = useState(false);
  const [auctionSection, setAuctionSection] = useState<"lots" | "squads">("lots");

  const refresh = () => {
    summary.reload();
    lots.reload();
  };

  const canManageAuctionLots = Boolean(
    isAdmin
    && data
    && ["upcoming", "active"].includes(data.season.status)
    && ["not_started", "in_progress"].includes(data.season.auctionLifecycleStatus),
  );
  const canEditAuction = Boolean(canManageAuctionLots && data?.season.auctionLifecycleStatus === "in_progress");
  const canNominate = canManageAuctionLots;
  const canEditLot = (lot: AuctionLot) => canEditAuction || (
    canManageAuctionLots
    && data?.season.auctionLifecycleStatus === "not_started"
    && lot.auctionStatus === "pending"
  );
  const playerNameFor = (lot: AuctionLot) =>
    typeof lot.playerRef === "string" ? lot.playerRef : lot.playerRef.name;
  const playerImageFor = (lot: AuctionLot) =>
    typeof lot.playerRef === "string" ? null : lot.playerRef.profilePic;
  const teamNameFor = (lot: AuctionLot) =>
    typeof lot.seasonTeamRef === "string" || !lot.seasonTeamRef
      ? "Unassigned"
      : lot.seasonTeamRef.displayName;

  const openEdit = (lot: AuctionLot) => {
    const assignedTeamId = typeof lot.seasonTeamRef === "string"
      ? lot.seasonTeamRef
      : lot.seasonTeamRef?._id ?? "";
    setEditingLot(lot);
    setEditStatus(lot.auctionStatus);
    setEditPosition(lot.playerPosition);
    setEditIconPlayer(lot.isIconPlayer);
    setEditGoalkeeper(lot.playerPosition === "goalkeeper");
    setEditTeamId(assignedTeamId || data?.teams[0]?.seasonTeamId || "");
    setEditPrice(lot.purchasePrice === null ? "" : String(lot.purchasePrice));
    setEditJersey(lot.jerseyNo === null ? "" : String(lot.jerseyNo));
  };

  const closeEdit = () => {
    setEditingLot(null);
    setEditTeamId("");
    setEditPrice("");
    setEditJersey("");
  };

  const selectedEditTeam = data?.teams.find((team) => team.seasonTeamId === editTeamId);
  const previousPriceOnSelectedTeam = editingLot?.auctionStatus === "sold" &&
    (typeof editingLot.seasonTeamRef === "string" ? editingLot.seasonTeamRef : editingLot.seasonTeamRef?._id) === editTeamId
    ? editingLot.purchasePrice ?? 0
    : 0;

  const saveLot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingLot) return;
    if (editStatus === "sold" && (!editTeamId || editPrice.trim() === "")) {
      toast.error("Choose a team and enter the purchase price for a sold lot.");
      return;
    }
    setSaving(true);
    try {
      await updateAuctionLot(editingLot._id, {
        auctionStatus: editStatus,
        playerPosition: editPosition,
        isIconPlayer: editIconPlayer,
        isGoalkeeper: editGoalkeeper,
        ...(editStatus === "sold"
          ? {
              seasonTeamId: editTeamId,
              purchasePrice: Number(editPrice),
              jerseyNo: editJersey.trim() ? Number(editJersey) : null,
            }
          : {}),
      });
      toast.success("Auction lot updated");
      closeEdit();
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  /* Shared runner for start / complete / reopen so the three buttons behave identically. */
  const runLifecycle = async (
    options: { title: string; description: string; confirmLabel: string },
    action: (id: string) => Promise<unknown>,
    successMessage: string,
  ) => {
    const yes = await confirm(options);
    if (!yes) return;
    setSaving(true);
    try {
      await action(selectedSeasonId);
      toast.success(successMessage);
      refresh();
      seasons.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const seasonOpen = Boolean(data && ["upcoming", "active"].includes(data.season.status));
  const lifecycle = data?.season.auctionLifecycleStatus;

  const statusMessage = !data
    ? ""
    : data.season.status === "draft"
      ? "Move this season to Upcoming from the Seasons page before creating auction lots."
      : data.season.status === "completed" || data.season.status === "archived"
        ? "This season is read-only. Auction lot changes are no longer available."
        : lifecycle === "not_started"
          ? "Auction setup: create, edit or remove Pending lots. Start the auction after the configured player nominations are ready."
          : lifecycle === "in_progress"
            ? "Auction in progress: you can create lots, edit lot details and remove Pending lots. Sold, Unsold and Withdrawn records are protected by auction rules."
            : "Auction completed. Reopen the auction to make further lot changes.";

  return (
    <PageContainer>
      <AdminPageBanner
        breadcrumb="Admin / Season operations"
        title="Auctions"
        description="Season-wise nominations, player purchases, budgets and squad composition."
      />

      {/* ------------------------- Control bar ------------------------- */}
      <div className="mb-5 flex flex-col gap-4 rounded-3xl border border-line bg-glass p-4 shadow-glass backdrop-blur-xl sm:flex-row sm:flex-wrap sm:items-end sm:p-5">
        <div className="w-full sm:max-w-xs">
          <label htmlFor="auction-season" className="mb-1.5 block text-sm font-semibold text-fg">Season</label>
          <Select
            id="auction-season"
            value={selectedSeasonId}
            onChange={(event) => {
              setSeasonId(event.target.value);
              setTeamFilter("");
              setStatusFilter("");
              setPositionFilter("");
              setPlayerName("");
              setIconFilter("");
              setGoalkeeperFilter("");
            }}
          >
            <option value="">Select season</option>
            {seasons.data?.data.map((season) => (
              <option key={season._id} value={season._id}>{season.name} · {season.year}</option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canNominate ? <Button onClick={() => setNominateOpen(true)}>Create auction lot (Nominate Player)</Button> : null}

          {isAdmin && seasonOpen && lifecycle === "not_started" ? (
            <Button
              variant="surface"
              disabled={saving}
              onClick={() => runLifecycle(
                {
                  title: "Start the auction?",
                  description: "The server will verify the configured team count, nominated player count and season rules before opening bidding.",
                  confirmLabel: "Start auction",
                },
                startSeasonAuction,
                "Auction started",
              )}
            >Start auction</Button>
          ) : null}

          {isAdmin && seasonOpen && lifecycle === "in_progress" ? (
            <Button
              variant="surface"
              disabled={saving}
              onClick={() => runLifecycle(
                {
                  title: "Complete this season auction?",
                  description: "The server will validate every lot, team roster, squad size, Icon Player and Goalkeeper quota, and team budget. The auction remains open if any check fails.",
                  confirmLabel: "Validate and complete",
                },
                completeSeasonAuction,
                "Auction completed successfully",
              )}
            >Complete auction</Button>
          ) : null}

          {isAdmin && seasonOpen && lifecycle === "completed" ? (
            <Button
              variant="surface"
              disabled={saving}
              onClick={() => runLifecycle(
                {
                  title: "Reopen this auction?",
                  description: "Existing lot assignments, sale history and fixtures will be preserved. Fixture creation and editing will be locked until the auction is completed again.",
                  confirmLabel: "Reopen auction",
                },
                reopenSeasonAuction,
                "Auction resumed",
              )}
            >Reopen auction</Button>
          ) : null}

          {lifecycle === "completed" ? <Pill className="bg-success/15 text-success">Auction completed</Pill> : null}
          {lifecycle === "in_progress" ? <Pill className="bg-info/15 text-info">Auction in progress</Pill> : null}
        </div>
      </div>

      {data ? (
        <GlassCard className="relative mb-5 overflow-hidden border-accent/20 p-5 sm:p-6">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/15 via-transparent to-accent/10" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Selected season</p>
              <h2 className="mt-1 font-display text-3xl text-fg sm:text-4xl">{data.season.name}</h2>
              <p className="mt-1 text-sm text-muted">Edition {selectedSeason?.seasonNumber ?? "—"} · {data.season.year}</p>
              <p className="mt-2 text-xs text-muted">{selectedSeason?.startDate?.slice(0, 10) ?? "Start date not set"} — {selectedSeason?.endDate?.slice(0, 10) ?? "End date not set"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill className="bg-surface text-fg">{data.season.status}</Pill>
              <Pill className="bg-accent/10 text-fg">{data.season.auctionLifecycleStatus === "not_started" ? "Auction not started" : data.season.auctionLifecycleStatus === "in_progress" ? "Auction in progress" : "Auction completed"}</Pill>
            </div>
          </div>
        </GlassCard>
      ) : null}

      {isAdmin && data ? (
        <p className="mb-5 rounded-2xl border border-line bg-glass px-4 py-3 text-sm text-muted backdrop-blur-md" role="status">
          {statusMessage}
        </p>
      ) : null}
      {!isAdmin ? (
        <p className="mb-5 text-sm text-muted">Sign in with an administrator account to create or manage auction lots.</p>
      ) : null}

      {seasons.loading ? <Skeleton className="h-24" /> : null}
      {seasons.error ? <ErrorState message={seasons.error} onRetry={seasons.reload} /> : null}
      {summary.loading ? <Skeleton className="h-48" /> : null}
      {summary.error ? <ErrorState message={summary.error} onRetry={summary.reload} /> : null}

      {data ? (
        <>
          {/* --------------------------- Stats --------------------------- */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
            <StatTile label="Teams registered" value={`${registeredTeamCount}/${teamRegistrationLimit}`} current={registeredTeamCount} limit={teamRegistrationLimit} />
            <StatTile label="Team slots remaining" value={Math.max(teamRegistrationLimit - registeredTeamCount, 0)} />
            <StatTile label="Players nominated" value={`${nominatedLots.length}/${playerNominationLimit}`} current={nominatedLots.length} limit={playerNominationLimit} />
            <StatTile label="Nominations remaining" value={Math.max(playerNominationLimit - nominatedLots.length, 0)} />
            <StatTile label="Pending auction lots" value={data.totals.pending} />
            <StatTile label="Sold" value={data.totals.sold} />
            <StatTile label="Unsold" value={data.totals.unsold} />
            <StatTile label="Icon players" value={`${nominatedIconCount}/${iconQuotaLimit}`} current={nominatedIconCount} limit={iconQuotaLimit} />
            <StatTile label="Goalkeepers" value={`${nominatedGoalkeeperCount}/${goalkeeperQuotaLimit}`} current={nominatedGoalkeeperCount} limit={goalkeeperQuotaLimit} />
            <StatTile label="Sold value" value={formatCurrency(data.totals.totalSoldValue)} />
          </div>

          <div className="mt-6 rounded-2xl border border-line bg-surface/70 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-fg">Choose a view</p>
                <p className="text-xs text-muted">Switch between auction lots and team budgets/squads.</p>
              </div>
              <Pill className="bg-primary/10 text-accent">View switcher</Pill>
            </div>
            <Tabs variant="switcher" ariaLabel="Auction page view" value={auctionSection}
              onChange={(value) => setAuctionSection(value as "lots" | "squads")}
              tabs={[
                { value: "lots", label: "Auction lots" },
                { value: "squads", label: "Team budgets and squads" },
              ]}
            />
          </div>

          {/* ----------------------- Squads & budgets ----------------------- */}
          {auctionSection === "squads" ? (
            <section className="mt-7">
              <SectionTitle title="Team budgets and squads" />
              <div className="grid gap-4 lg:grid-cols-2">
                {data.teams.map((team) => (
                  <GlassCard key={team.seasonTeamId} className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={team.displayName} asset={team.logoSnapshot} className="h-14 w-14 shrink-0 rounded-xl ring-2 ring-line" />
                        <div className="min-w-0">
                          <h3 className="font-display text-2xl text-fg">{team.displayName}</h3>
                          <Pill className="mt-1 bg-surface text-muted">{team.status}</Pill>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-xl tabular text-fg">
                          {team.playersSigned}/{data.season.auctionSettings.teamSquadSize}
                        </p>
                        <p className="text-xs text-muted">players</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-xs text-muted">
                        <span>Budget used</span>
                        <span className="tabular">{formatCurrency(team.totalSpent)} / {formatCurrency(team.budget)}</span>
                      </div>
                      <ProgressBar value={team.totalSpent} max={team.budget} />
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                      {([
                        ["Balance", formatCurrency(team.balance)],
                        ["Average price", formatCurrency(team.averagePrice)],
                        ["Icon / Goalkeeper", `${team.iconCount} / ${team.goalkeeperCount}`],
                        ["Slots remaining", team.remainingSlots],
                      ] as Array<[string, string | number]>).map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-surface p-2.5">
                          <dt className="text-xs text-muted">{label}</dt>
                          <dd className="mt-0.5 font-semibold tabular text-fg">{value}</dd>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-4 space-y-2">
                      {team.lots.length ? team.lots.map((lot) => (
                        <div
                          key={lot._id}
                          className="flex items-center gap-3 rounded-2xl border border-line bg-glass p-3 text-sm backdrop-blur-md"
                        >
                          <Avatar name={playerNameFor(lot)} asset={playerImageFor(lot)} className="h-11 w-11 shrink-0 rounded-xl" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-fg">{playerNameFor(lot)}</p>
                            <p className="truncate text-xs text-muted">
                              {POSITIONS[lot.playerPosition]}
                              {lot.jerseyNo ? ` · #${lot.jerseyNo}` : ""}
                              {lot.isIconPlayer ? " · Icon" : ""}
                              {lot.isGoalkeeper ? " · Goalkeeper" : ""}
                            </p>
                          </div>
                          <span className="shrink-0 font-semibold tabular text-fg">{formatCurrency(lot.purchasePrice ?? 0)}</span>
                          <Pill className={lot.auctionStatus === "withdrawn" ? STATUS_PILL.withdrawn : STATUS_PILL.sold}>
                            {lot.auctionStatus === "withdrawn" ? "Withdrawn" : "Sold"}
                          </Pill>
                          {canEditAuction && lot.auctionStatus !== "withdrawn" ? (
                            <Button size="sm" variant="ghost" onClick={() => openEdit(lot)}>Edit</Button>
                          ) : null}
                        </div>
                      )) : (
                        <p className="rounded-2xl border border-dashed border-line bg-glass p-4 text-center text-sm text-muted">
                          No players purchased yet.
                        </p>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </section>
          ) : null}

          {/* --------------------------- Lots --------------------------- */}
          {auctionSection === "lots" ? (
            <section className="mt-7">
              <SectionTitle title="Auction lots" aside={<Pill className="bg-glass text-muted ring-1 ring-line">{lotRows.length} result(s)</Pill>} />

              <div className="mb-5 grid gap-2 rounded-3xl border border-line bg-glass p-3 shadow-glass backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-6">
                <Input placeholder="Search Player Name" value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
                <Select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
                  <option value="">All teams</option>
                  {data.teams.map((team) => (
                    <option key={team.seasonTeamId} value={team.seasonTeamId}>{team.displayName}</option>
                  ))}
                </Select>
                <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AuctionLotStatus | "")}>
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="sold">Sold</option>
                  <option value="unsold">Unsold</option>
                  <option value="withdrawn">Withdrawn</option>
                </Select>
                <Select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value as SeasonPlayerPosition | "")}>
                  <option value="">All positions</option>
                  {Object.entries(POSITIONS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
                <Select value={iconFilter} onChange={(event) => setIconFilter(event.target.value)}>
                  <option value="">Icon: all</option>
                  <option value="true">Icon players</option>
                  <option value="false">Non-icon players</option>
                </Select>
                <Select value={goalkeeperFilter} onChange={(event) => setGoalkeeperFilter(event.target.value)}>
                  <option value="">Goalkeeper: all</option>
                  <option value="true">Goalkeepers</option>
                  <option value="false">Non-goalkeepers</option>
                </Select>
              </div>

              {lots.loading ? <Skeleton className="h-40" /> : null}
              {lots.error ? <ErrorState message={lots.error} onRetry={lots.reload} /> : null}
              {!lots.loading && !lots.error && !lotRows.length ? (
                <div className="rounded-2xl border border-dashed border-line bg-glass p-6 text-center text-sm text-muted backdrop-blur-md">
                  No auction lots match these filters.
                </div>
              ) : null}

              <div className="grid gap-3">
                {lotRows.map((lot) => (
                  <div
                    key={lot._id}
                    className={
                      "flex flex-col gap-3 rounded-2xl border border-l-4 border-line bg-glass p-4 shadow-glass backdrop-blur-xl " +
                      "transition-colors hover:bg-glass-strong sm:flex-row sm:items-center sm:justify-between " +
                      STATUS_EDGE[lot.auctionStatus]
                    }
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={playerNameFor(lot)} asset={playerImageFor(lot)} className="h-14 w-14 shrink-0 rounded-2xl ring-2 ring-line" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-fg">{playerNameFor(lot)}</h3>
                          <Pill className={STATUS_PILL[lot.auctionStatus]}>{lot.auctionStatus}</Pill>
                          {lot.isIconPlayer ? <Pill className="bg-gold/15 text-gold">Icon</Pill> : null}
                          {lot.isGoalkeeper ? <Pill className="bg-surface text-muted">Goalkeeper</Pill> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {POSITIONS[lot.playerPosition]} · {teamNameFor(lot)}
                          {lot.jerseyNo ? ` · #${lot.jerseyNo}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="mr-2 font-display text-xl tabular text-fg">
                        {lot.purchasePrice === null ? "—" : formatCurrency(lot.purchasePrice)}
                      </span>
                      {canEditLot(lot) && lot.auctionStatus !== "withdrawn" ? (
                        <Button size="sm" onClick={() => openEdit(lot)}>Edit lot</Button>
                      ) : null}
                      {canManageAuctionLots && lot.auctionStatus === "pending" && !lot.seasonTeamRef ? (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={saving}
                          onClick={async () => {
                            const yes = await confirm({
                              title: "Remove this pending auction lot?",
                              description: "The player will become available for nomination again. This action does not delete the player profile.",
                              confirmLabel: "Remove lot",
                              danger: true,
                            });
                            if (!yes) return;
                            setSaving(true);
                            try {
                              await deletePendingAuctionLot(lot._id);
                              toast.success("Pending auction lot removed");
                              refresh();
                            } catch (error) { toast.error(errorMessage(error)); }
                            finally { setSaving(false); }
                          }}
                        >Remove</Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {/* ----------------------- Create lot modal ----------------------- */}
      <Modal
        open={nominateOpen}
        title="Create auction lot"
        description="Create a Pending auction lot by selecting an active player. You can prepare, edit or remove Pending lots before starting the auction."
        onClose={() => setNominateOpen(false)}
      >
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!selectedSeasonId || !playerId || !playerPosition) { toast.error("Select a player and season position."); return; }
            if (isIconPlayer && nominatedIconCount >= iconQuotaLimit) { toast.error("The season Icon Player quota is full."); return; }
            if (isGoalkeeper && nominatedGoalkeeperCount >= goalkeeperQuotaLimit) { toast.error("The season Goalkeeper quota is full."); return; }
            setSaving(true);
            try {
              await nominatePlayer({ seasonId: selectedSeasonId, playerId, playerPosition, isIconPlayer, isGoalkeeper });
              toast.success("Player nominated");
              setNominateOpen(false);
              setPlayerId("");
              setPlayerSearch("");
              setPlayerPosition("");
              setIsIconPlayer(false);
              setIsGoalkeeper(false);
              refresh();
            } catch (error) {
              toast.error(errorMessage(error));
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="grid gap-2">
            <Field label="Search available players">
              <Input placeholder="Search by player name" value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} />
            </Field>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-line bg-glass p-2 backdrop-blur-md">
              {availablePlayers.map((player) => (
                <button
                  type="button"
                  key={player._id}
                  onClick={() => setPlayerId(player._id)}
                  aria-pressed={playerId === player._id}
                  className={
                    "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition " +
                    (playerId === player._id ? "border-accent bg-primary/15" : "border-line hover:bg-surface")
                  }
                >
                  <Avatar name={player.name} asset={player.profilePic} className="h-10 w-10 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{player.name}</span>
                  {playerId === player._id ? <Pill className="bg-accent text-accent-fg">Selected</Pill> : null}
                </button>
              ))}
              {!availablePlayers.length ? (
                <p className="p-3 text-center text-xs text-muted">
                  {playerRows.length ? "No available players match this search." : "No active players are available."}
                </p>
              ) : null}
            </div>
          </div>

          <Field label="Season position">
            <Select required value={playerPosition} onChange={(event) => { const next = event.target.value as SeasonPlayerPosition | ""; setPlayerPosition(next); setIsGoalkeeper(next === "goalkeeper"); }}>
              <option value="">Select position</option>
              {Object.entries(POSITIONS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-2 sm:grid-cols-2">
            <CheckField checked={isIconPlayer} onChange={setIsIconPlayer} label="Icon player" />
            <CheckField checked={isGoalkeeper} onChange={(checked) => { setIsGoalkeeper(checked); setPlayerPosition((current) => checked ? "goalkeeper" : current === "goalkeeper" ? "" : current); }} label="Goalkeeper" />
          </div>

          <div className="space-y-1 rounded-2xl border border-line bg-surface p-3 text-xs text-muted">
            <p>Season Icon Player quota: <strong className="text-fg">{nominatedIconCount}/{iconQuotaLimit}</strong> · {data?.season.auctionSettings.iconPlayerLimit ?? 0} per team × {teamRegistrationLimit} teams</p>
            <p>Season Goalkeeper quota: <strong className="text-fg">{nominatedGoalkeeperCount}/{goalkeeperQuotaLimit}</strong> · {data?.season.auctionSettings.goalkeeperLimit ?? 0} per team × {teamRegistrationLimit} teams</p>
          </div>

          {players.error ? <p className="text-sm text-danger">{players.error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="surface" onClick={() => setNominateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !playerId || !playerPosition}>{saving ? "Saving…" : "Create lot"}</Button>
          </div>
        </form>
      </Modal>

      {/* ------------------------ Edit lot modal ------------------------ */}
      <Modal
        open={Boolean(editingLot)}
        title="Edit auction lot"
        description="Correct the status, position, icon designation or sale details. Sale limits are recalculated before saving."
        onClose={closeEdit}
      >
        <form className="grid gap-4" onSubmit={saveLot}>
          {editingLot ? (
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-glass p-3 backdrop-blur-md">
              <Avatar name={playerNameFor(editingLot)} asset={playerImageFor(editingLot)} className="h-14 w-14 rounded-2xl ring-2 ring-line" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-fg">{playerNameFor(editingLot)}</p>
                <p className="text-xs text-muted">Lot #{editingLot.lotNumber ?? "—"}</p>
              </div>
            </div>
          ) : null}

          <Field label="Auction status">
            <Select value={editStatus} onChange={(event) => setEditStatus(event.target.value as AuctionLotStatus)}>
              {LOT_STATUSES.map((status) => (
                <option
                  key={status}
                  value={status}
                  disabled={
                    editingLot?.auctionStatus === "withdrawn"
                    || (status === "withdrawn" && editingLot?.auctionStatus !== "sold")
                    || (data?.season.auctionLifecycleStatus === "not_started" && status !== "pending")
                  }
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Season position">
            <Select value={editPosition} onChange={(event) => { const next = event.target.value as SeasonPlayerPosition; setEditPosition(next); setEditGoalkeeper(next === "goalkeeper"); }}>
              {Object.entries(POSITIONS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-2 sm:grid-cols-2">
            <CheckField checked={editIconPlayer} onChange={setEditIconPlayer} label="Icon player" />
            <CheckField checked={editGoalkeeper} onChange={(checked) => { setEditGoalkeeper(checked); setEditPosition((current) => checked ? "goalkeeper" : current === "goalkeeper" ? "midfielder" : current); }} label="Goalkeeper" />
          </div>

          {editStatus === "sold" ? (
            <>
              <Field label="Assigned season team">
                <Select required value={editTeamId} onChange={(event) => setEditTeamId(event.target.value)}>
                  <option value="">Select team</option>
                  {data?.teams.map((team) => (
                    <option
                      key={team.seasonTeamId}
                      value={team.seasonTeamId}
                      disabled={["withdrawn", "eliminated", "completed"].includes(team.status)}
                    >
                      {team.displayName} · balance {formatCurrency(team.balance)}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Purchase price (INR)">
                  <Input type="number" min="0" step="1" required value={editPrice} onChange={(event) => setEditPrice(event.target.value)} />
                </Field>
                <Field label="Jersey number (optional)">
                  <Input type="number" min="1" max="99" value={editJersey} onChange={(event) => setEditJersey(event.target.value)} />
                </Field>
              </div>
              {selectedEditTeam ? (
                <p className="rounded-2xl border border-line bg-surface p-3 text-xs text-muted">
                  Estimated balance after this purchase:{" "}
                  <strong className="tabular text-fg">
                    {formatCurrency(selectedEditTeam.balance + previousPriceOnSelectedTeam - (Number(editPrice) || 0))}
                  </strong>
                </p>
              ) : null}
            </>
          ) : (
            <p className="rounded-2xl border border-line bg-surface p-3 text-xs text-muted">
              Withdrawn players retain their original team and sale details as history. Sold players can return to Pending or Unsold only if their team has no fixtures.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="surface" onClick={closeEdit}>Cancel</Button>
            <Button type="submit" disabled={saving || (editStatus === "sold" && (!editTeamId || editPrice.trim() === ""))}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}