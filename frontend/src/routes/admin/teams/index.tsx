import { createFileRoute } from "@tanstack/react-router";
import { TeamsPage } from "@/pages/teams/TeamsPage";

export const Route = createFileRoute("/admin/teams/")({
  component: TeamsPage,
});
