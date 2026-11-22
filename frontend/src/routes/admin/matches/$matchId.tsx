import { createFileRoute, redirect } from "@tanstack/react-router";
import { SeasonMatchDetailsPage } from "@/pages/matches/SeasonMatchDetailsPage";

export const Route = createFileRoute("/admin/matches/$matchId")({
  validateSearch: (search: Record<string, unknown>): { seasonId?: string } => ({
    seasonId: typeof search.seasonId === "string" ? search.seasonId : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (!search.seasonId) throw redirect({ to: "/admin/matches" });
  },
  component: function AdminMatchDetailsRoute() {
    const { matchId } = Route.useParams();
    const { seasonId } = Route.useSearch();
    return <SeasonMatchDetailsPage seasonId={seasonId!} matchId={matchId} adminMode />;
  },
});
