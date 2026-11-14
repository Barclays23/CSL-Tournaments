import { createFileRoute } from "@tanstack/react-router";
import { OrganizersPage } from "@/pages/admin/OrganizersPage";
export const Route = createFileRoute("/admin/organizers")({ component: OrganizersPage });
