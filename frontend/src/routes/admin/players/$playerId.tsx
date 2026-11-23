import { createFileRoute } from "@tanstack/react-router";
import { PlayerDetailsPage } from "@/pages/players/PlayerDetailsPage";

export const Route = createFileRoute("/admin/players/$playerId")({
  component: function AdminPlayerRoute() {
    const { playerId } = Route.useParams();
    return <PlayerDetailsPage playerId={playerId} adminMode />;
  },
});
