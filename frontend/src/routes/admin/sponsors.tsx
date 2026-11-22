import { createFileRoute } from "@tanstack/react-router";
import { SponsorsPage } from "@/pages/sponsors/SponsorsPage";

export const Route = createFileRoute("/admin/sponsors")({
  component: SponsorsPage,
});
