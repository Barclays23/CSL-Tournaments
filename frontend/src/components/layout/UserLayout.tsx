import type { ReactNode } from "react";
import { Outlet } from "@tanstack/react-router";
import { Footer } from "@/components/layout/Footer";
import { UserNavbar } from "@/components/layout/UserNavbar";

export function UserLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip">
      <UserNavbar />
      <main className="min-w-0 w-full flex-1 overflow-x-clip">
        {children ?? <Outlet />}
      </main>
      <Footer />
    </div>
  );
}
