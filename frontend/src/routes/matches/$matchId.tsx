import { createFileRoute } from "@tanstack/react-router";
import { MatchDetailsPage } from "@/pages/matches/MatchDetailsPage";
import { SeasonMatchDetailsPage } from "@/pages/matches/SeasonMatchDetailsPage";

export const Route = createFileRoute("/matches/$matchId")({
  validateSearch: (search: Record<string, unknown>): { seasonId?: string } => ({
    seasonId: typeof search.seasonId === "string" ? search.seasonId : undefined,
  }),
  component: function MatchRoute() {
    const { matchId } = Route.useParams();
    const { seasonId } = Route.useSearch();
    return seasonId
      ? <SeasonMatchDetailsPage seasonId={seasonId} matchId={matchId} />
      : <MatchDetailsPage matchId={matchId} />;
  },
});
