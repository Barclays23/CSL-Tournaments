import { createFileRoute } from "@tanstack/react-router";
import { PlayerDetailsPage } from "@/pages/players/PlayerDetailsPage";

export const Route = createFileRoute("/players/$playerId")({
  component: function PublicPlayerRoute() {
    const { playerId } = Route.useParams();
    return <PlayerDetailsPage playerId={playerId} />;
  },
});
