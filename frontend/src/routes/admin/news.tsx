import { createFileRoute } from "@tanstack/react-router";
import { NewsManagementPage } from "@/pages/admin/NewsManagementPage";
export const Route = createFileRoute("/admin/news")({ component: NewsManagementPage });
