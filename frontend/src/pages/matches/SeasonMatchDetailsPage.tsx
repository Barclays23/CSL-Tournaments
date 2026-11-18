import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Drawer } from "@/components/ui/Drawer";
import { SeasonMatchForm } from "@/components/forms/SeasonMatchForm";
import { PageContainer } from "@/components/layout/PageContainer";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import {
  addSeasonMatchGoal,
  deleteSeasonMatchGoal,
  getSeasonMatchById,
  updateSeasonMatch,
  updateSeasonMatchGoal,
  updateSeasonMatchResolution,
} from "@/services/seasonMatchService";
import { getSeasonTeams, getAuctionLots } from "@/services/seasonService";
import { getVenues } from "@/services/venueService";
import type { SeasonMatch, SeasonMatchTeamRef, SeasonMatchWrite } from "@/types/seasonMatch.types";
import type { AuctionLot } from "@/types/season.types";
import { formatDate, formatTime } from "@/utils/formatDate";
import { refId } from "@/utils/refs";

const STAGE_LABEL: Record<SeasonMatch["stage"], string> = {
  group: "Group stage",
  round_of_16: "Round of 16",
  quarter_final: "Quarter-final",
  semi_final: "Semi-final",
  third_place: "Third-place playoff",
  final: "Final",
};
const STATUS_LABEL: Record<SeasonMatch["status"], string> = {
  scheduled: "Upcoming",
  live: "Live",
  completed: "Full time",
  postponed: "Postponed",
  cancelled: "Cancelled",
  abandoned: "Abandoned",
};

function teamDetails(ref: SeasonMatchTeamRef) {
  if (typeof ref === "string") return { id: ref, name: "Team", logo: null };
  return { id: ref._id, name: ref.displayName, logo: ref.logoSnapshot ?? ref.team?.logo ?? null };
}
function lotTeamId(lot: AuctionLot) {
  return typeof lot.seasonTeamRef === "string" ? lot.seasonTeamRef : lot.seasonTeamRef?._id ?? "";
}
function lotPlayer(lot: AuctionLot) {
  return typeof lot.playerRef === "string" ? null : lot.playerRef;
}

export function SeasonMatchDetailsPage({ seasonId, matchId }: { seasonId: string; matchId: string }) {
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const [resolutionStatus, setResolutionStatus] = useState<"cancelled" | "abandoned">("cancelled");
  const [resolutionReason, setResolutionReason] = useState("");
  const [savingResolution, setSavingResolution] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingMatch, setSavingMatch] = useState(false);
  const [goalTeamId, setGoalTeamId] = useState("");
  const [goalType, setGoalType] = useState<"normal" | "own_goal">("normal");
  const [goalPlayerId, setGoalPlayerId] = useState("");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);

  const matchQuery = useServiceQuery(() => getSeasonMatchById(seasonId, matchId), [seasonId, matchId]);
  const teamsQuery = useServiceQuery(() => getSeasonTeams(seasonId), [seasonId]);
  const groupsQuery = useServiceQuery(() => import("@/services/seasonMatchService").then(({ getSeasonGroups }) => getSeasonGroups(seasonId)), [seasonId]);
  const venuesQuery = useServiceQuery(() => getVenues("all"), []);
  const lotsQuery = useServiceQuery(() => getAuctionLots({ seasonId, auctionStatus: "sold" }), [seasonId]);
  const match = matchQuery.data?.data;

  if (matchQuery.loading) return <PageContainer><Skeleton className="h-64" /></PageContainer>;
  if (matchQuery.error || !match) {
    return <PageContainer><ErrorState message={matchQuery.error || "Fixture not found"} onRetry={matchQuery.reload} /></PageContainer>;
  }

  const home = teamDetails(match.homeSeasonTeamRef);
  const away = teamDetails(match.awaySeasonTeamRef);
  const homeScore = match.goals.filter((goal) => refId(goal.scoringSeasonTeamRef) === home.id).length;
  const awayScore = match.goals.filter((goal) => refId(goal.scoringSeasonTeamRef) === away.id).length;
  const winnerId = refId(match.winnerSeasonTeamRef);
  const scoringTeamId = goalTeamId || home.id;
  const playerTeamId = goalType === "normal" ? scoringTeamId : scoringTeamId === home.id ? away.id : home.id;
  const eligibleGoalPlayers = (lotsQuery.data?.data ?? []).filter((lot) => lotTeamId(lot) === playerTeamId && lotPlayer(lot));
  const canManageGoals = isAdmin && !["cancelled", "abandoned"].includes(match.status);

  const saveResolution = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = resolutionReason.trim();
    if (reason.length < 3) { toast.error("Enter a resolution reason"); return; }
    setSavingResolution(true);
    try {
      await updateSeasonMatchResolution(seasonId, matchId, { status: resolutionStatus, resolutionReason: reason });
      toast.success("Fixture resolution saved");
      setResolutionReason("");
      matchQuery.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save fixture resolution");
    } finally {
      setSavingResolution(false);
    }
  };

  const saveGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scoringTeamId || !goalPlayerId && goalType === "normal") {
      toast.error("Choose the credited team and goal scorer");
      return;
    }
    setSavingGoal(true);
    try {
      const payload = {
        scoringSeasonTeamRef: scoringTeamId,
        scorerPlayerRef: goalPlayerId || null,
        goalType,
      };
      if (editingGoalId) await updateSeasonMatchGoal(seasonId, matchId, editingGoalId, payload);
      else await addSeasonMatchGoal(seasonId, matchId, payload);
      toast.success(editingGoalId ? "Goal updated" : "Goal added");
      setEditingGoalId(null);
      setGoalTeamId("");
      setGoalType("normal");
      setGoalPlayerId("");
      matchQuery.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save goal");
    } finally {
      setSavingGoal(false);
    }
  };

  const beginGoalEdit = (goal: SeasonMatch["goals"][number]) => {
    setEditingGoalId(goal._id);
    setGoalTeamId(refId(goal.scoringSeasonTeamRef) ?? home.id);
    setGoalType(goal.goalType);
    setGoalPlayerId(refId(goal.scorerPlayerRef) ?? "");
  };

  const removeGoal = async (goalId: string) => {
    const yes = await confirm({
      title: "Remove this goal?",
      description: "The score, standings, winner and top-scorer statistics will be recalculated.",
      confirmLabel: "Remove goal",
      danger: true,
    });
    if (!yes) return;
    try {
      await deleteSeasonMatchGoal(seasonId, matchId, goalId);
      toast.success("Goal removed");
      if (editingGoalId === goalId) setEditingGoalId(null);
      matchQuery.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove goal");
    }
  };

  return (
    <PageContainer>
      <Link to="/matches" search={{ seasonId }} className="text-sm font-semibold text-accent">Back to fixtures</Link>
      <GlassCard className="mt-4 p-5">
        {isAdmin && !["completed", "cancelled", "abandoned"].includes(match.status) ? (
          <div className="mb-3 flex justify-end"><Button variant="surface" onClick={() => setEditing(true)}>Edit fixture</Button></div>
        ) : null}
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted">
          Match {match.matchNumber} · Round {match.roundNumber} · {STAGE_LABEL[match.stage]} · {STATUS_LABEL[match.status]}
        </p>
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex flex-col items-center gap-2 text-center">
            <Avatar name={home.name} asset={home.logo} className="h-16 w-16 rounded-xl" />
            <p className="font-semibold text-fg">{home.name}</p>
          </div>
          <p className="font-display text-5xl tabular text-fg">
            {match.status === "live" || match.status === "completed" || match.goals.length ? `${homeScore} – ${awayScore}` : "vs"}
          </p>
          <div className="flex flex-col items-center gap-2 text-center">
            <Avatar name={away.name} asset={away.logo} className="h-16 w-16 rounded-xl" />
            <p className="font-semibold text-fg">{away.name}</p>
          </div>
        </div>
        {match.penaltyShootout ? (
          <p className="mt-4 text-center text-sm text-gold">
            Penalties {match.penaltyShootout.homeTeamScore} – {match.penaltyShootout.awayTeamScore}
            {winnerId ? ` · ${winnerId === home.id ? home.name : away.name} win` : ""}
          </p>
        ) : null}
        <p className="mt-4 text-center text-sm text-muted">
          {formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)}
          {match.venueRef && typeof match.venueRef === "object" ? ` · ${match.venueRef.name}` : match.venue ? ` · ${match.venue}` : ""}
        </p>
        {match.notes ? <p className="mt-3 text-center text-sm text-muted">{match.notes}</p> : null}
        {match.resolutionHistory?.length ? (
          <div className="mt-4 border-t border-line pt-3">
            <h3 className="text-sm font-semibold text-fg">Fixture resolution history</h3>
            <ul className="mt-2 space-y-2">
              {match.resolutionHistory.map((entry, index) => (
                <li key={entry.decidedAt + entry.status + index} className="rounded-lg bg-surface p-3 text-sm">
                  <p className="font-medium text-fg">{entry.status === "cancelled" ? "Cancelled" : "Abandoned"} · {formatDate(entry.decidedAt)}</p>
                  <p className="mt-1 text-muted">{entry.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </GlassCard>
      {isAdmin && match.status !== "completed" && (!(match.status === "cancelled" || match.status === "abandoned") || !match.resolutionHistory?.some((entry) => entry.status === match.status && entry.reason.trim().length >= 3)) ? (
        <GlassCard className="mt-4 p-5">
          <h2 className="font-semibold text-fg">Resolve or record fixture decision</h2>
          <p className="mt-1 text-sm text-muted">Cancelling or abandoning a fixture requires an audited reason. This decision remains in the fixture history and is checked before a participating team can withdraw.</p>
          <form className="mt-3 grid gap-3" onSubmit={saveResolution}>
            <label className="text-sm font-medium text-fg">Decision
              <select className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-sm text-fg" value={resolutionStatus} onChange={(event) => setResolutionStatus(event.target.value as "cancelled" | "abandoned")}>
                <option value="cancelled">Cancel fixture</option>
                <option value="abandoned">Abandon fixture</option>
              </select>
            </label>
            <label className="text-sm font-medium text-fg">Reason for decision
              <Textarea className="mt-1" required minLength={3} maxLength={500} value={resolutionReason} onChange={(event) => setResolutionReason(event.target.value)} placeholder="Record who decided and why this fixture was cancelled or abandoned." />
            </label>
            <Button type="submit" disabled={savingResolution || resolutionReason.trim().length < 3}>{savingResolution ? "Saving…" : "Save fixture decision"}</Button>
          </form>
        </GlassCard>
      ) : null}
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-3xl text-fg">Goals</h2>
          {canManageGoals ? <Button size="sm" onClick={() => { setEditingGoalId(null); setGoalTeamId(home.id); setGoalType("normal"); setGoalPlayerId(""); }}>Add goal</Button> : null}
        </div>
        {match.goals.length === 0 ? <p className="text-sm text-muted">No goals recorded.</p> : (
          <ul className="flex flex-col gap-2">
            {match.goals.map((goal) => {
              const scorer = goal.scorerPlayerRef && typeof goal.scorerPlayerRef !== "string" ? goal.scorerPlayerRef.name : null;
              const scoringTeam = typeof goal.scoringSeasonTeamRef === "string" ? "Team" : goal.scoringSeasonTeamRef.displayName;
              return (
                <li key={goal._id} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-glass px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-fg">{goal.goalType === "own_goal" ? `Own goal · ${scorer ?? "Player"}` : scorer ?? "Scorer not recorded"}</p>
                    <p className="text-xs text-muted">{scoringTeam}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted">{new Date(goal.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
                    {canManageGoals ? <>
                      <Button size="sm" variant="surface" onClick={() => beginGoalEdit(goal)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => void removeGoal(goal._id)}>Delete</Button>
                    </> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {canManageGoals && (editingGoalId !== null || goalTeamId !== "") ? (
        <GlassCard className="mt-4 p-5">
          <h3 className="font-semibold text-fg">{editingGoalId ? "Edit goal" : "Record a goal"}</h3>
          <form className="mt-3 grid gap-3" onSubmit={saveGoal}>
            <label className="text-sm font-medium text-fg">Team credited
              <select className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-sm text-fg" value={scoringTeamId} onChange={(event) => { setGoalTeamId(event.target.value); setGoalPlayerId(""); }}>
                <option value={home.id}>{home.name}</option>
                <option value={away.id}>{away.name}</option>
              </select>
            </label>
            <label className="text-sm font-medium text-fg">Goal type
              <select className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-sm text-fg" value={goalType} onChange={(event) => { setGoalType(event.target.value as "normal" | "own_goal"); setGoalPlayerId(""); }}>
                <option value="normal">Normal goal</option>
                <option value="own_goal">Own goal</option>
              </select>
            </label>
            <label className="text-sm font-medium text-fg">Player
              <select className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-sm text-fg" value={goalPlayerId} onChange={(event) => setGoalPlayerId(event.target.value)}>
                <option value="">{goalType === "own_goal" ? "Player not recorded" : "Choose scorer"}</option>
                {eligibleGoalPlayers.map((lot) => {
                  const player = lotPlayer(lot);
                  return player ? <option key={player._id} value={player._id}>{player.name}</option> : null;
                })}
              </select>
            </label>
            <p className="text-xs text-muted">{goalType === "own_goal" ? "Choose a player from the opposing team. The goal is credited to the selected team." : "Choose a player sold to the team credited with the goal."}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={savingGoal || (goalType === "normal" && !goalPlayerId)}>{savingGoal ? "Saving…" : editingGoalId ? "Save goal changes" : "Save goal"}</Button>
              <Button type="button" variant="surface" onClick={() => { setEditingGoalId(null); setGoalTeamId(""); setGoalPlayerId(""); setGoalType("normal"); }}>Cancel</Button>
            </div>
          </form>
          {lotsQuery.error ? <p className="mt-2 text-xs text-danger">{lotsQuery.error}</p> : null}
        </GlassCard>
      ) : null}
      <Drawer open={editing} title="Edit fixture" onClose={() => setEditing(false)}>
        <SeasonMatchForm
          seasonTeams={teamsQuery.data?.data ?? []}
          groups={groupsQuery.data?.data ?? []}
          venues={venuesQuery.data?.data ?? []}
          match={match}
          submitting={savingMatch}
          onSubmit={async (values: SeasonMatchWrite) => {
            setSavingMatch(true);
            try {
              await updateSeasonMatch(seasonId, matchId, values);
              toast.success("Fixture updated");
              setEditing(false);
              matchQuery.reload();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to update fixture");
              throw error;
            } finally {
              setSavingMatch(false);
            }
          }}
        />
      </Drawer>
    </PageContainer>
  );
}
