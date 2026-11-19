import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAuth } from "@/contexts/AuthContext";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import {
  getSeasons,
  getAuctionSummary,
  getAuctionLots,
  closeSeasonAuction,
  nominatePlayer,
  updateAuctionLot,
} from "@/services/seasonService";
import { getPlayers } from "@/services/playerService";
import type { AuctionLot, AuctionLotStatus, SeasonPlayerPosition } from "@/types/season.types";
import type { ApiResponse } from "@/types/api.types";
import type { AdminPlayer, PublicPlayer } from "@/types/player.types";
import { formatCurrency } from "@/utils/formatCurrency";
import { errorMessage } from "@/utils/errorHandler";

const EMPTY_LOTS: ApiResponse<AuctionLot[]> = { success: true, message: "", data: [] };
const EMPTY_SUMMARY: ApiResponse<null> = { success: true, message: "", data: null };
const POSITIONS: Record<SeasonPlayerPosition, string> = {
  goalkeeper: "Goalkeeper",
  defender: "Defender",
  midfielder: "Midfielder",
  forward: "Forward",
};
const LOT_STATUSES: AuctionLotStatus[] = ["pending", "sold", "unsold", "withdrawn"];

export function AuctionsPage() {
  const { isAdmin } = useAuth();
  const seasons = useServiceQuery(() => getSeasons(), []);
  const [seasonId, setSeasonId] = useState("");

  useEffect(() => {
    if (!seasonId && seasons.data?.data.length) {
      const active = seasons.data.data.find((season) => season.status === "active");
      setSeasonId(active ? active._id : seasons.data.data[0]._id);
    }
  }, [seasonId, seasons.data]);

  const [teamFilter, setTeamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<AuctionLotStatus | "">("");
  const [positionFilter, setPositionFilter] = useState<SeasonPlayerPosition | "">("");
  const [playerName, setPlayerName] = useState("");
  const [iconFilter, setIconFilter] = useState("");
  const [goalkeeperFilter, setGoalkeeperFilter] = useState("");
  const summary = useServiceQuery(
    () => seasonId
      ? getAuctionSummary(seasonId)
      : Promise.resolve(EMPTY_SUMMARY as unknown as Awaited<ReturnType<typeof getAuctionSummary>>),
    [seasonId],
  );
  const lots = useServiceQuery(
    () => seasonId
      ? getAuctionLots({
          seasonId,
          ...(teamFilter ? { seasonTeamId: teamFilter } : {}),
          ...(statusFilter ? { auctionStatus: statusFilter } : {}),
          ...(positionFilter ? { playerPosition: positionFilter } : {}),
          ...(playerName.trim() ? { playerName: playerName.trim() } : {}),
          ...(iconFilter ? { isIconPlayer: iconFilter === "true" } : {}),
          ...(goalkeeperFilter ? { isGoalkeeper: goalkeeperFilter === "true" } : {}),
        })
      : Promise.resolve(EMPTY_LOTS),
    [seasonId, teamFilter, statusFilter, positionFilter, playerName, iconFilter, goalkeeperFilter],
  );
  const players = useServiceQuery(() => getPlayers({ limit: 100, status: "active" }), []);

  const data = summary.data?.data;
  const lotRows = lots.data?.data ?? [];
  const playerRows = (players.data?.data ?? []) as Array<PublicPlayer | AdminPlayer>;
  const nominatedPlayerIds = new Set((data?.lots ?? []).map((lot) => typeof lot.playerRef === "string" ? lot.playerRef : lot.playerRef._id));
  const availablePlayers = playerRows.filter((player) => !nominatedPlayerIds.has(player._id) && (!playerSearch.trim() || player.name.toLowerCase().includes(playerSearch.trim().toLowerCase())));

  const [nominateOpen, setNominateOpen] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
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

  const refresh = () => {
    summary.reload();
    lots.reload();
  };

  const canEditAuction = Boolean(isAdmin && data && data.season.status === "upcoming" && !data.season.auctionClosedAt);
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
    setEditGoalkeeper(lot.isGoalkeeper);
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

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Season auction"
        title="Auctions"
        description="Season-wise nominations, player purchases, budgets and squad composition."
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full max-w-sm">
          <label className="mb-1.5 block text-sm font-medium text-fg">Season</label>
          <Select
            value={seasonId}
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
        {canEditAuction ? <Button onClick={() => setNominateOpen(true)}>Nominate player</Button> : null}
        {isAdmin && data?.season.status === "upcoming" && !data.season.auctionClosedAt ? (
          <Button variant="surface" disabled={saving || data.totals.pending > 0} onClick={async () => {
            if (!window.confirm("Close this season auction? No further nominations, sales or lot edits will be allowed.")) return;
            setSaving(true);
            try {
              await closeSeasonAuction(seasonId);
              toast.success("Season auction closed");
              refresh();
              seasons.reload();
            } catch (error) { toast.error(errorMessage(error)); }
            finally { setSaving(false); }
          }}>Close auction</Button>
        ) : null}
        {data?.season.auctionClosedAt ? <span className="self-center text-xs font-medium text-success">Auction closed</span> : null}
      </div>

      {seasons.loading ? <Skeleton className="h-24" /> : null}
      {seasons.error ? <ErrorState message={seasons.error} onRetry={seasons.reload} /> : null}
      {summary.loading ? <Skeleton className="h-48" /> : null}
      {summary.error ? <ErrorState message={summary.error} onRetry={summary.reload} /> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {([
              ["Teams", data.totals.participatingTeams],
              ["Nominated", data.totals.lots],
              ["Sold", data.totals.sold],
              ["Pending", data.totals.pending],
              ["Unsold", data.totals.unsold],
              ["Sold value", formatCurrency(data.totals.totalSoldValue)],
            ] as Array<[string, string | number]>).map(([label, value]) => (
              <GlassCard key={label} className="p-4">
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-2 text-xl font-semibold text-fg">{value}</p>
              </GlassCard>
            ))}
          </div>

          <section className="mt-7">
            <h2 className="mb-3 font-display text-2xl text-fg">Team budgets and squads</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.teams.map((team) => (
                <GlassCard key={team.seasonTeamId} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-2xl text-fg">{team.displayName}</h3>
                      <p className="text-xs text-muted">{team.status}</p>
                    </div>
                    <span className="text-sm text-muted">
                      {team.playersSigned}/{data.season.auctionSettings.teamSquadSize} players
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div><p className="text-muted">Budget</p><p className="font-semibold text-fg">{formatCurrency(team.budget)}</p></div>
                    <div><p className="text-muted">Spent</p><p className="font-semibold text-fg">{formatCurrency(team.totalSpent)}</p></div>
                    <div><p className="text-muted">Balance</p><p className="font-semibold text-fg">{formatCurrency(team.balance)}</p></div>
                    <div><p className="text-muted">Average price</p><p className="font-semibold text-fg">{formatCurrency(team.averagePrice)}</p></div>
                    <div><p className="text-muted">Icon / Goalkeeper</p><p className="font-semibold text-fg">{team.iconCount} / {team.goalkeeperCount}</p></div>
                    <div><p className="text-muted">Slots remaining</p><p className="font-semibold text-fg">{team.remainingSlots}</p></div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {team.lots.length ? team.lots.map((lot) => (
                      <div key={lot._id} className="flex items-center gap-3 rounded-xl bg-surface p-3 text-sm">
                        <Avatar name={playerNameFor(lot)} asset={playerImageFor(lot)} className="h-10 w-10 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-fg">{playerNameFor(lot)}</p>
                          <p className="truncate text-xs text-muted">
                            {POSITIONS[lot.playerPosition]}
                            {lot.jerseyNo ? ` · #${lot.jerseyNo}` : ""}
                            {lot.isIconPlayer ? " · Icon" : ""}
                            {lot.isGoalkeeper ? " · Goalkeeper" : ""}
                          </p>
                        </div>
                        <span className="shrink-0 font-medium text-fg">{formatCurrency(lot.purchasePrice ?? 0)}</span>
                        {canEditAuction ? (
                          <Button size="sm" variant="ghost" onClick={() => openEdit(lot)}>Edit</Button>
                        ) : null}
                      </div>
                    )) : (
                      <p className="rounded-xl bg-surface p-3 text-sm text-muted">No players purchased yet.</p>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl text-fg">Auction lots</h2>
              <span className="text-xs text-muted">{lotRows.length} result(s)</span>
            </div>
            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
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
              <GlassCard className="p-5 text-sm text-muted">No auction lots match these filters.</GlassCard>
            ) : null}
            <div className="grid gap-3">
              {lotRows.map((lot) => (
                <GlassCard key={lot._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={playerNameFor(lot)} asset={playerImageFor(lot)} className="h-12 w-12 shrink-0 rounded-xl" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-fg">{playerNameFor(lot)}</h3>
                        <span className="rounded-full bg-surface px-2 py-1 text-xs text-muted">{lot.auctionStatus}</span>
                        {lot.isIconPlayer ? <span className="rounded-full bg-surface px-2 py-1 text-xs text-gold">Icon</span> : null}
                        {lot.isGoalkeeper ? <span className="rounded-full bg-surface px-2 py-1 text-xs text-muted">Goalkeeper</span> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {POSITIONS[lot.playerPosition]} · {teamNameFor(lot)}
                        {lot.jerseyNo ? ` · #${lot.jerseyNo}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-sm font-semibold text-fg">
                      {lot.purchasePrice === null ? "—" : formatCurrency(lot.purchasePrice)}
                    </span>
                    {canEditAuction ? <Button size="sm" onClick={() => openEdit(lot)}>Edit lot</Button> : null}
                  </div>
                </GlassCard>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <Modal
        open={nominateOpen}
        title="Nominate a player"
        description="A player may be nominated only once in this season. Icon Player and Goalkeeper are independent designations."
        onClose={() => setNominateOpen(false)}
      >
        <form
          className="grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!seasonId || !playerId || !playerPosition) { toast.error("Select a player and season position."); return; }
            setSaving(true);
            try {
              await nominatePlayer({ seasonId, playerId, playerPosition, isIconPlayer, isGoalkeeper });
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
            <label className="block text-sm text-fg">
              Search available players
              <Input className="mt-1" placeholder="Search by player name" value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} />
            </label>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-line p-2">
              {availablePlayers.map((player) => (
                <button type="button" key={player._id} onClick={() => setPlayerId(player._id)} aria-pressed={playerId === player._id}
                  className={"flex w-full items-center gap-3 rounded-xl border p-2 text-left transition " + (playerId === player._id ? "border-accent bg-primary/10" : "border-line hover:bg-surface")}>
                  <Avatar name={player.name} asset={player.profilePic} className="h-10 w-10 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{player.name}</span>
                  {playerId === player._id ? <span className="text-xs text-accent">Selected</span> : null}
                </button>
              ))}
              {!availablePlayers.length ? <p className="p-3 text-center text-xs text-muted">{playerRows.length ? "No available players match this search." : "No active players are available."}</p> : null}
            </div>
          </div>
          <label className="block text-sm text-fg">
            Season position
            <Select className="mt-1" required value={playerPosition} onChange={(event) => setPlayerPosition(event.target.value as SeasonPlayerPosition | "")}>
              <option value="">Select position</option>
              {Object.entries(POSITIONS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={isIconPlayer} onChange={(event) => setIsIconPlayer(event.target.checked)} />
            Icon player
          </label>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={isGoalkeeper} onChange={(event) => setIsGoalkeeper(event.target.checked)} />
            Goalkeeper
          </label>
          {players.error ? <p className="text-sm text-danger">{players.error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="surface" onClick={() => setNominateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !playerId || !playerPosition}>{saving ? "Saving…" : "Nominate"}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingLot)}
        title="Edit auction lot"
        description="Correct the status, position, icon designation or sale details. Sale limits are recalculated before saving."
        onClose={closeEdit}
      >
        <form className="grid gap-3" onSubmit={saveLot}>
          {editingLot ? (
            <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
              <Avatar name={playerNameFor(editingLot)} asset={playerImageFor(editingLot)} className="h-12 w-12 rounded-xl" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-fg">{playerNameFor(editingLot)}</p>
                <p className="text-xs text-muted">Lot #{editingLot.lotNumber ?? "—"}</p>
              </div>
            </div>
          ) : null}
          <label className="block text-sm text-fg">
            Auction status
            <Select className="mt-1" value={editStatus} onChange={(event) => setEditStatus(event.target.value as AuctionLotStatus)}>
              {LOT_STATUSES.map((status) => (
                <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
              ))}
            </Select>
          </label>
          <label className="block text-sm text-fg">
            Season position
            <Select className="mt-1" value={editPosition} onChange={(event) => setEditPosition(event.target.value as SeasonPlayerPosition)}>
              {Object.entries(POSITIONS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={editIconPlayer} onChange={(event) => setEditIconPlayer(event.target.checked)} />
            Icon player
          </label>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={editGoalkeeper} onChange={(event) => setEditGoalkeeper(event.target.checked)} />
            Goalkeeper
          </label>
          {editStatus === "sold" ? (
            <>
              <label className="block text-sm text-fg">
                Assigned season team
                <Select className="mt-1" required value={editTeamId} onChange={(event) => setEditTeamId(event.target.value)}>
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
              </label>
              <label className="block text-sm text-fg">
                Purchase price (INR)
                <Input className="mt-1" type="number" min="0" step="1" required value={editPrice} onChange={(event) => setEditPrice(event.target.value)} />
              </label>
              <label className="block text-sm text-fg">
                Jersey number (optional)
                <Input className="mt-1" type="number" min="1" max="99" value={editJersey} onChange={(event) => setEditJersey(event.target.value)} />
              </label>
              {selectedEditTeam ? (
                <p className="text-xs text-muted">
                  Estimated balance after this purchase: {formatCurrency(selectedEditTeam.balance + previousPriceOnSelectedTeam - (Number(editPrice) || 0))}
                </p>
              ) : null}
            </>
          ) : (
            <p className="rounded-lg bg-surface p-3 text-xs text-muted">
              Changing the status away from Sold clears the assigned team, purchase price and jersey number.
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
