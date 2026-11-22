import { createFileRoute } from "@tanstack/react-router";
import { ManagersPage } from "@/pages/managers/ManagersPage";

export const Route = createFileRoute("/admin/managers")({
  component: ManagersPage,
});
