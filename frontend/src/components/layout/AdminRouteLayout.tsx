import { AdminRoute } from "@/components/auth/AdminRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";

export function AdminRouteLayout() {
  return (
    <AdminRoute>
      <AdminLayout />
    </AdminRoute>
  );
}
