import { createFileRoute, Navigate } from "@tanstack/react-router";

/** Legacy URL compatibility: all tournament configuration now belongs to a selected Season. */
export const Route = createFileRoute("/admin/settings")({
  component: () => <Navigate to="/admin/seasons" replace />,
});
