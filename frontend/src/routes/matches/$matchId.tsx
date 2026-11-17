import { createFileRoute, redirect } from "@tanstack/react-router";
import { SeasonMatchDetailsPage } from "@/pages/matches/SeasonMatchDetailsPage";

export const Route = createFileRoute("/matches/$matchId")({
  validateSearch: (search: Record<string, unknown>): { seasonId?: string } => ({
    seasonId: typeof search.seasonId === "string" ? search.seasonId : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (!search.seasonId) throw redirect({ to: "/matches" });
  },
  component: function MatchRoute() {
    const { matchId } = Route.useParams();
    const { seasonId } = Route.useSearch();
    return <SeasonMatchDetailsPage seasonId={seasonId!} matchId={matchId} />;
  },
});
