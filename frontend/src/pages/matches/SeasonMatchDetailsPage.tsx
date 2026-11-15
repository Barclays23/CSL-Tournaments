import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageContainer } from "@/components/layout/PageContainer";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { getSeasonMatchById } from "@/services/seasonMatchService";
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
      </GlassCard>
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
