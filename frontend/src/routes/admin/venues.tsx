import { createFileRoute } from "@tanstack/react-router";
import { VenuesPage } from "@/pages/admin/VenuesPage";
export const Route = createFileRoute("/admin/venues")({ component: VenuesPage });
