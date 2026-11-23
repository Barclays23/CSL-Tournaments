import { createRootRoute, Outlet } from "@tanstack/react-router";
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


function RootError({ error, reset }: { error: Error; reset: () => void }) {
  return <RouteErrorPage error={error} reset={reset} />;
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
