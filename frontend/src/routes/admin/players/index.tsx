import { createFileRoute } from "@tanstack/react-router";
import { PlayersPage } from "@/pages/players/PlayersPage";

export const Route = createFileRoute("/admin/players/")({
  component: PlayersPage,
});
