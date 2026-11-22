import { Outlet } from "@tanstack/react-router";
import { Footer } from "@/components/layout/Footer";
import { UserNavbar } from "@/components/layout/UserNavbar";

export function UserLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <UserNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
