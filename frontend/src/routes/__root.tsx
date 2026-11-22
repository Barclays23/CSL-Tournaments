import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { UserLayout } from "@/components/layout/UserLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotFoundPage } from "@/pages/NotFoundPage";

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

function RootNotFound() {
  return (
    <UserLayout>
      <NotFoundPage />
    </UserLayout>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: RootNotFound,
});
