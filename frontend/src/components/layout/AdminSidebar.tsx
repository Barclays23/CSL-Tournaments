import {
  CalendarDays,
  CircleUserRound,
  Gavel,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  Newspaper,
  ShieldCheck,
  Trophy,
  Users,
  UsersRound,
  UserRound,
  Handshake,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CslMark } from "@/components/brand/CslMark";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/cn";

interface AdminNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Home", to: "/", icon: Home },
  { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Auctions", to: "/admin/auctions", icon: Gavel },
  { label: "Managers", to: "/admin/managers", icon: UsersRound },
  { label: "Matches", to: "/admin/matches", icon: CalendarDays },
  { label: "News", to: "/admin/news", icon: Newspaper },
  { label: "Organizers", to: "/admin/organizers", icon: ShieldCheck },
  { label: "Players", to: "/admin/players", icon: UserRound },
  { label: "Seasons", to: "/admin/seasons", icon: Trophy },
  { label: "Sponsors", to: "/admin/sponsors", icon: Handshake },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Teams", to: "/admin/teams", icon: UsersRound },
  { label: "Venues", to: "/admin/venues", icon: MapPin },
];

interface SidebarContentProps {
  collapsed: boolean;
  onMobileClose?: () => void;
}

function SidebarContent({ collapsed, onMobileClose }: SidebarContentProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useAuth();

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);

  const initials = user?.name
    ?.trim()
    .split(/\\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";

  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-line px-4">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <CslMark className="h-9 w-9 shrink-0" />
          {!collapsed ? (
            <span className="truncate font-display text-lg tracking-wide text-fg">CSL Admin</span>
          ) : null}
        </Link>
        {onMobileClose ? (
          <button
            type="button"
            aria-label="Close admin navigation"
            onClick={onMobileClose}
            className="ml-auto rounded-xl p-2 text-muted transition-colors hover:bg-surface hover:text-fg"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin navigation">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to as never}
              onClick={onMobileClose}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                collapsed && "justify-center px-2",
                active
                  ? "bg-accent text-accent-fg shadow-sm"
                  : "text-muted hover:bg-surface hover:text-fg",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-line p-3">
        {user ? (
          <div
            className={cn(
              "mb-3 flex min-w-0 items-center gap-3 rounded-xl bg-surface px-2.5 py-3",
              collapsed && "justify-center px-1",
            )}
            title={collapsed ? `${user.name} — ${user.email}` : undefined}
          >
            {user.profilePic?.url ? (
              <img
                src={user.profilePic.url}
                alt={user.name}
                className="h-9 w-9 shrink-0 rounded-full border border-line object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                {initials}
              </span>
            )}
            {!collapsed ? (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-fg">{user.name}</span>
                <span className="block truncate text-xs text-muted">{user.email}</span>
              </span>
            ) : null}
          </div>
        ) : (
          <div className={cn("mb-3 flex items-center gap-3 px-2.5 py-3", collapsed && "justify-center")}>
            <CircleUserRound className="h-8 w-8 shrink-0 text-muted" />
            {!collapsed ? <span className="text-sm text-muted">Administrator</span> : null}
          </div>
        )}

        <Link
          to="/logout"
          onClick={onMobileClose}
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/10",
            collapsed && "justify-center px-2",
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed ? <span>Logout</span> : null}
        </Link>
      </div>
    </>
  );
}

export function AdminSidebar({
  collapsed,
  mobileOpen,
  onMobileClose,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  return (
    <>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-glass transition-[width] duration-200 md:flex",
          collapsed ? "w-20" : "w-72",
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close admin navigation"
            onClick={onMobileClose}
            className="absolute inset-0 bg-bg/75 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-line bg-glass-strong shadow-glass">
            <SidebarContent collapsed={false} onMobileClose={onMobileClose} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
