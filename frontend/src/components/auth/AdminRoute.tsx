import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/PageContainer";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      void navigate({ to: user ? "/" : "/admin/login", replace: true });
    }
  }, [isAdmin, isLoading, navigate, user]);

  if (isLoading || !isAdmin) {
    return <LoadingSpinner mode="page" label="Checking administrator session" />;
  }

  return <>{children}</>;
}
