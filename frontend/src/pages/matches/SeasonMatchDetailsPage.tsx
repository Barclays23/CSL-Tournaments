import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageContainer } from "@/components/layout/PageContainer";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { getSeasonMatchById, updateSeasonMatchResolution } from "@/services/seasonMatchService";
import type { SeasonMatch, SeasonMatchTeamRef } from "@/types/seasonMatch.types";
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

export function SeasonMatchDetailsPage({ seasonId, matchId }: { seasonId: string; matchId: string }) {
  const { isAdmin } = useAuth();
  const [resolutionStatus, setResolutionStatus] = useState<"cancelled" | "abandoned">("cancelled");
  const [resolutionReason, setResolutionReason] = useState("");
  const [savingResolution, setSavingResolution] = useState(false);
  const matchQuery = useServiceQuery(() => getSeasonMatchById(seasonId, matchId), [seasonId, matchId]);
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

  return (
    <PageContainer>
      <Link to="/matches" search={{ seasonId }} className="text-sm font-semibold text-accent">Back to fixtures</Link>
      <GlassCard className="mt-4 p-5">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted">
          Match {match.matchNumber} · {STAGE_LABEL[match.stage]} · {STATUS_LABEL[match.status]}
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
          {match.venue ? ` · ${match.venue}` : ""}
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
        <h2 className="mb-3 font-display text-3xl text-fg">Goals</h2>
        {match.goals.length === 0 ? (
          <p className="text-sm text-muted">No goals recorded.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {match.goals.map((goal) => {
              const scorer = goal.scorerPlayerRef && typeof goal.scorerPlayerRef !== "string"
                ? goal.scorerPlayerRef.name
                : null;
              const scoringTeam = typeof goal.scoringSeasonTeamRef === "string"
                ? "Team"
                : goal.scoringSeasonTeamRef.displayName;
              return (
                <li key={goal._id} className="flex items-center justify-between gap-3 rounded-control border border-line bg-glass px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-fg">{goal.goalType === "own_goal" ? `Own goal · ${scorer ?? "Player"}` : scorer ?? "Scorer not recorded"}</p>
                    <p className="text-xs text-muted">{scoringTeam}</p>
                  </div>
                  <span className="text-xs font-semibold text-muted">{new Date(goal.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
