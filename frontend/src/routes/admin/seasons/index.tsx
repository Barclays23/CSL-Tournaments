import { createFileRoute } from "@tanstack/react-router";
import { SeasonsPage } from "@/pages/admin/SeasonsPage";

export const Route = createFileRoute("/admin/seasons/")({
  component: SeasonsPage,
});
