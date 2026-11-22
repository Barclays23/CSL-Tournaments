import { createFileRoute } from "@tanstack/react-router";
import { TeamDetailsPage } from "@/pages/teams/TeamDetailsPage";

export const Route = createFileRoute("/admin/teams/$teamId")({
  component: function AdminTeamRoute() {
    const { teamId } = Route.useParams();
    return <TeamDetailsPage teamId={teamId} />;
  },
});
