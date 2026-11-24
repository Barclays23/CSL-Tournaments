import { createRootRoute, Outlet } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { UserLayout } from "@/components/layout/UserLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RouteErrorPage } from "@/components/ui/RouteErrorPage";

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ConfirmProvider>
          <Outlet />
          <ToastProvider />
        </ConfirmProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}


function RootError({ error, reset }: ErrorComponentProps) {
  const normalizedError = error instanceof Error
    ? error
    : new Error("An unexpected application error occurred", { cause: error });

  return <RouteErrorPage error={normalizedError} reset={reset} />;
}

function RootNotFound() {
  return (
    <UserLayout>
      <NotFoundPage />
    </UserLayout>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: RootError,
  notFoundComponent: RootNotFound,
});
