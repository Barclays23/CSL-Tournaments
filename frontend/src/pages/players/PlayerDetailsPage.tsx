import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { PlayerForm } from "@/components/forms/PlayerForm";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import type { PlayerFormValues } from "@/schemas/player.schema";
import { deactivatePlayer, deletePlayer, getPlayerById, updatePlayer } from "@/services/playerService";
import { getPlayerHistory } from "@/services/seasonStatisticsService";
import { getSeasonAwards } from "@/services/seasonAwardService";
import type { Asset } from "@/types/api.types";
import type { SeasonAward } from "@/types/seasonAward.types";
import { errorMessage } from "@/utils/errorHandler";
import { formatCurrency } from "@/utils/formatCurrency";
import { isAdminRecord } from "@/utils/forms";

export function PlayerDetailsPage({ playerId }: { playerId: string }) {
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const player = useServiceQuery(() => getPlayerById(playerId, isAdmin), [playerId, isAdmin]);
  const history = useServiceQuery(() => getPlayerHistory(playerId), [playerId]);
  const awardSeasonIds = Array.from(new Set(history.data?.data.auctionHistory.map((entry) => entry.season._id) ?? []));
  const playerAwards = useServiceQuery(async () => {
    const responses = await Promise.all(awardSeasonIds.map((seasonId) => getSeasonAwards(seasonId)));
    return responses.flatMap((response) => Array.isArray(response.data) ? response.data : [])
      .filter((award: SeasonAward) => award.recipients?.some((recipient) => recipient.playerRef === playerId));
  }, [playerId, awardSeasonIds.join("|")]);
  const record = player.data?.data;
  const admin = record && isAdminRecord(record) ? record : null;
  const current = history.data?.data.currentSeasonTeam;
  const currentLot = history.data?.data.auctionHistory.find((entry) => entry.season._id === history.data?.data.currentSeason?._id);

  const save = async (values: PlayerFormValues, photo: Asset | null) => {
    setSaving(true);
    try {
      await updatePlayer(playerId, { ...values, profilePic: photo });
      toast.success("Player profile updated");
      setOpen(false);
      player.reload();
      history.reload();
    } catch (error) { toast.error(errorMessage(error)); throw error; }
    finally { setSaving(false); }
  };

  if (player.loading) return <PageContainer><Skeleton className="h-64" /></PageContainer>;
  if (player.error || !record) return <PageContainer><ErrorState message={player.error || "Player not found"} onRetry={player.reload} /></PageContainer>;

  return (
    <PageContainer>
      <Link to="/players" className="text-sm font-semibold text-accent">Back to players</Link>
      <GlassCard className="mt-4 grid gap-6 p-5 sm:grid-cols-[auto_1fr]">
        <Avatar name={record.name} asset={record.profilePic} className="h-28 w-28" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-4xl text-fg">{record.name}</h1>
            <Badge tone={record.status === "active" ? "success" : "neutral"}>{record.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">Permanent player profile</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Mobile</dt><dd className="text-fg">{admin?.mobile || "—"}</dd></div>
            <div><dt className="text-xs text-muted">Email</dt><dd className="text-fg">{admin?.email || "—"}</dd></div>
            <div><dt className="text-xs text-muted">Date of birth</dt><dd className="text-fg">{admin?.dateOfBirth ? new Date(admin.dateOfBirth).toLocaleDateString() : "—"}</dd></div>
            <div><dt className="text-xs text-muted">Notes</dt><dd className="text-fg">{admin?.notes || "—"}</dd></div>
          </dl>
          {isAdmin ? <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => setOpen(true)}>Edit profile</Button>
            {record.status === "active" ? <Button variant="surface" onClick={async () => {
              try { await deactivatePlayer(playerId); toast.success("Player deactivated"); player.reload(); }
              catch (error) { toast.error(errorMessage(error)); }
            }}>Deactivate</Button> : null}
            <Button variant="danger" onClick={async () => {
              const yes = await confirm({ title: `Delete ${record.name}?`, description: "Players with auction, match, shootout or award history cannot be hard-deleted. Deactivate the player to preserve history.", confirmLabel: "Delete player", danger: true });
              if (!yes) return;
              try { await deletePlayer(playerId); toast.success("Player deleted"); window.history.back(); }
              catch (error) { toast.error(errorMessage(error)); }
            }}>Delete</Button>
          </div> : null}
        </div>
      </GlassCard>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-3xl text-fg">Season profile & history</h2>
        {history.loading ? <Skeleton className="h-40" /> : null}
        {history.error ? <ErrorState message={history.error} onRetry={history.reload} /> : null}
        {history.data?.data ? <>
          <div className="grid gap-3 sm:grid-cols-2">
            <GlassCard className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Current season</p>
              <p className="mt-1 font-semibold text-fg">{history.data.data.currentSeason?.name ?? "No active season"}</p>
              {current ? <>
                <div className="mt-3 flex items-center gap-3">
                  {current.team.logo?.url ? <img src={current.team.logo.url} alt="" className="h-12 w-12 rounded-lg object-contain" /> : <div className="h-12 w-12 rounded-lg bg-surface" />}
                  <div><p className="font-semibold text-fg">{current.team.displayName}</p><p className="text-xs text-muted">{current.position} · {current.jerseyNo ? `#${current.jerseyNo}` : "No jersey number"}</p></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>{currentLot?.status ?? "sold"}</Badge>
                  {current.isIconPlayer ? <Badge tone="gold">Icon player</Badge> : null}
                  {current.isGoalkeeper ? <Badge tone="primary">Goalkeeper</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-muted">Purchase price: {current.purchasePrice === null ? "Not available" : formatCurrency(current.purchasePrice)}</p>
              </> : currentLot ? <>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>{currentLot.status}</Badge>
                  {currentLot.isIconPlayer ? <Badge tone="gold">Icon player</Badge> : null}
                  {currentLot.isGoalkeeper ? <Badge tone="primary">Goalkeeper</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-muted">{currentLot.position} · {currentLot.jerseyNo ? `#${currentLot.jerseyNo}` : "No jersey assigned"}</p>
                <p className="mt-1 text-sm text-muted">{currentLot.status === "pending" ? "This player has been nominated but has not been sold." : "No team is assigned to this auction lot."}</p>
                {currentLot.purchasePrice !== null ? <p className="mt-1 text-sm text-muted">Purchase price: {formatCurrency(currentLot.purchasePrice)}</p> : null}
              </> : <p className="mt-2 text-sm text-muted">This player has no AuctionLot in the active season.</p>}
            </GlassCard>
            <GlassCard className="p-4">
              <p className="text-xs text-muted">Career normal-time goals</p>
              <p className="mt-1 font-display text-4xl text-fg">{history.data.data.totalNormalGoals}</p>
              <p className="text-sm text-muted">Own goals and penalty shootout kicks are excluded.</p>
            </GlassCard>
          </div>

          <GlassCard className="mt-4 p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-accent">Career honours</p><h3 className="font-display text-2xl text-fg">Season achievements & awards</h3></div><Badge>{playerAwards.data?.length ?? 0} award(s)</Badge></div>
            {playerAwards.loading ? <Skeleton className="mt-3 h-20" /> : null}
            {playerAwards.error ? <div className="mt-3"><ErrorState message={playerAwards.error} onRetry={playerAwards.reload} /></div> : null}
            {!playerAwards.loading && !playerAwards.error && playerAwards.data?.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {playerAwards.data.map((award) => {
                const recipient = award.recipients.find((item) => item.playerRef === playerId);
                const season = history.data?.data.auctionHistory.find((entry) => entry.season._id === award.seasonRef)?.season;
                return <div key={award._id} className="flex items-center gap-3 rounded-xl bg-surface p-3">
                  <img src={recipient?.profileImageSnapshot?.url ?? "https://placehold.co/96x96?text=CSL"} alt="" className="h-12 w-12 rounded-full object-cover" />
                  <div className="min-w-0"><p className="font-semibold text-fg">{award.title}</p><p className="text-xs text-muted">{season ? `${season.name} · ${season.year}` : "Season award"}</p><p className="text-xs text-muted">{recipient?.teamNameSnapshot ?? "Team snapshot unavailable"}</p></div>
                </div>;
              })}
            </div> : null}
            {!playerAwards.loading && !playerAwards.error && !playerAwards.data?.length ? <p className="mt-3 text-sm text-muted">No individual season awards recorded for this player yet.</p> : null}
          </GlassCard>

          <GlassCard className="mt-4 p-4">
            <h3 className="font-display text-2xl text-fg">Auction & team movement history</h3>
            {history.data.data.auctionHistory.length ? <div className="mt-3 space-y-2">
              {history.data.data.auctionHistory.map((entry, index) => <div key={entry.season._id + "-" + index} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-3 text-sm">
                <div><p className="font-semibold text-fg">{entry.season.name} · {entry.season.year}</p><p className="text-xs text-muted">{entry.team?.displayName ?? "No team"} · {entry.position}{entry.isIconPlayer ? " · Icon" : ""}{entry.isGoalkeeper ? " · Goalkeeper" : ""}</p></div>
                <div className="text-right"><p className="font-medium text-fg">{entry.status}</p><p className="text-xs text-muted">{entry.purchasePrice === null ? "—" : formatCurrency(entry.purchasePrice)}{entry.jerseyNo ? " · #" + entry.jerseyNo : ""}</p></div>
              </div>)}
            </div> : <p className="mt-3 text-sm text-muted">No auction participation has been recorded.</p>}
          </GlassCard>

          <GlassCard className="mt-4 p-4">
            <h3 className="font-display text-2xl text-fg">Goals by season</h3>
            {history.data.data.goalHistory.length ? <div className="mt-3 flex flex-wrap gap-2">{history.data.data.goalHistory.map((item) => <div key={item.season._id} className="rounded-xl bg-surface px-4 py-3"><p className="text-xs text-muted">{item.season.name}</p><p className="font-semibold text-fg">{item.goals} goal(s)</p></div>)}</div> : <p className="mt-3 text-sm text-muted">No normal-time goals recorded.</p>}
          </GlassCard>
        </> : null}
      </section>
      <Drawer open={open} title="Edit player profile" onClose={() => setOpen(false)}>
        <PlayerForm player={record} submitting={saving} onSubmit={save} />
      </Drawer>
    </PageContainer>
  );
}
