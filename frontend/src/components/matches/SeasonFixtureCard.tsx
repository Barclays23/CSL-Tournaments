import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
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
  return {
    id: ref._id,
    name: ref.displayName,
    logo: ref.logoSnapshot ?? ref.team?.logo ?? null,
  };
}

export function SeasonFixtureCard({
  match,
  groupName,
}: {
  match: SeasonMatch;
  groupName?: string | null;
}) {
  const home = teamDetails(match.homeSeasonTeamRef);
  const away = teamDetails(match.awaySeasonTeamRef);
  const homeScore = match.goals.filter((goal) => refId(goal.scoringSeasonTeamRef) === home.id).length;
  const awayScore = match.goals.filter((goal) => refId(goal.scoringSeasonTeamRef) === away.id).length;
  const showScore = match.status === "live" || match.status === "completed" || match.goals.length > 0;

  return (
    <Link
      to="/matches/$matchId"
      params={{ matchId: match._id }}
      search={{ seasonId: match.seasonRef }}
      className="block"
    >
      <GlassCard className="p-4 transition duration-200 hover:border-accent">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <span>Match {match.matchNumber} · {STAGE_LABEL[match.stage]}{groupName ? ` · ${groupName}` : ""}</span>
          <span>{STATUS_LABEL[match.status]}</span>
        </div>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Avatar name={home.name} asset={home.logo} className="h-12 w-12 rounded-xl" />
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <p className="truncate text-right font-semibold text-fg">{home.name}</p>
            <p className="font-display text-3xl tabular text-fg">
              {showScore ? `${homeScore} – ${awayScore}` : "vs"}
            </p>
            <p className="truncate text-left font-semibold text-fg">{away.name}</p>
          </div>
          <Avatar name={away.name} asset={away.logo} className="h-12 w-12 rounded-xl" />
        </div>
        {match.penaltyShootout ? (
          <p className="mt-2 text-center text-sm text-gold">
            Penalties {match.penaltyShootout.homeTeamScore} – {match.penaltyShootout.awayTeamScore}
          </p>
        ) : null}
        <p className="mt-3 text-center text-xs text-muted">
          {formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)}
          {match.venue ? ` · ${match.venue}` : ""}
        </p>
      </GlassCard>
    </Link>
  );
}
