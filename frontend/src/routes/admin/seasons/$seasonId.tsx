import { createFileRoute } from "@tanstack/react-router";
import { SeasonDetailsPage } from "@/pages/admin/SeasonDetailsPage";

export const Route = createFileRoute("/admin/seasons/$seasonId")({
  component: function SeasonWorkspaceRoute() {
    const { seasonId } = Route.useParams();
    return <SeasonDetailsPage seasonId={seasonId} />;
  },
});
