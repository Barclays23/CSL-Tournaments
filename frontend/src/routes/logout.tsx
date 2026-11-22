import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/PageContainer";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";

function LogoutPage() {
  const { logout } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void logout().catch(() => undefined);
  }, [logout]);

  return (
    <PageContainer>
      <LoadingSpinner label="Signing out" />
    </PageContainer>
  );
}

export const Route = createFileRoute("/logout")({
  component: LogoutPage,
});
