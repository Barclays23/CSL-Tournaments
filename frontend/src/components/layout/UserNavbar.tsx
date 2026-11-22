import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, LogIn, LogOut, Menu } from "lucide-react";
import { CslMark } from "@/components/brand/CslMark";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { NAV_ITEMS } from "@/components/layout/userNavItems";
import { IconButton } from "@/components/ui/IconButton";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/cn";


export function UserNavbar() {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hash = useRouterState({ select: (state) => state.location.hash });
  const { isAuthenticated, isAdmin, user } = useAuth();
  return <header className="sticky top-0 z-40 border-b border-line bg-glass backdrop-blur-xl">
    <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
      <Link to="/" className="flex items-center gap-2"><CslMark className="h-9 w-9" /><span className="font-display text-xl leading-none tracking-wide text-fg">CSL</span></Link>
      <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const active = item.hash ? pathname === "/" && hash === item.hash : item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return <Link key={item.label} to={item.to} hash={"hash" in item ? item.hash : undefined} className={cn("rounded-full px-3 py-2 text-sm font-medium", active ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}>{item.label}</Link>;
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        {isAuthenticated ? <div className="relative hidden sm:block">
          <button type="button" aria-expanded={accountOpen} onClick={()=>setAccountOpen((value)=>!value)} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-sm font-semibold text-fg">
            {user?.name.split(" ")[0] ?? "Account"}<ChevronDown className="h-4 w-4" />
          </button>
          {accountOpen ? <div className="absolute right-0 top-full z-50 mt-2 min-w-48 rounded-xl border border-line bg-glass-strong p-2 shadow-glass">
            {isAdmin ? <Link to="/admin/dashboard" onClick={()=>setAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-fg hover:bg-surface">Admin Dashboard</Link> : null}
            <Link to="/logout" onClick={()=>setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"><LogOut className="h-4 w-4" />Log out</Link>
          </div> : null}
        </div> : <Link to="/login" className="hidden sm:inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg"><LogIn className="h-4 w-4" />Login</Link>}
        <IconButton className="lg:hidden" aria-label="Open menu" onClick={()=>setOpen(true)}><Menu className="h-5 w-5" /></IconButton>
      </div>
    </div>
    <MobileMenu open={open} onClose={()=>setOpen(false)} />
  </header>;
}
