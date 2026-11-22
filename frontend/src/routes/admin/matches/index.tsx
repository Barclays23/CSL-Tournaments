import { createFileRoute } from "@tanstack/react-router";
import { MatchesPage } from "@/pages/matches/MatchesPage";

export const Route = createFileRoute("/admin/matches/")({
  validateSearch: (search: Record<string, unknown>): { seasonId?: string } => ({
    seasonId: typeof search.seasonId === "string" ? search.seasonId : undefined,
  }),
  component: function AdminMatchesRoute() {
    const { seasonId } = Route.useSearch();
    return <MatchesPage initialSeasonId={seasonId} managementMode />;
  },
});
