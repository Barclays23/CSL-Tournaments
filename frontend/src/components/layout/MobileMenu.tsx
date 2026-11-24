import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { LogIn, LogOut, X } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/userNavItems";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/cn";

export function MobileMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isAuthenticated, isAdmin } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hash = useRouterState({ select: (state) => state.location.hash });

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-100 lg:hidden">
      {/* The backdrop is a separate click target, so clicks outside the panel close it. */}
      <button
        type="button"
        aria-label="Close navigation menu"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <aside
        id="user-mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        className="absolute inset-y-0 left-0 z-10 flex w-[min(22rem,88vw)] max-w-full flex-col overflow-y-auto overscroll-y-contain border border-line bg-success-fg/50 p-3 shadow-glass"
      >
        <div className="flex items-center justify-between border-b border-line pb-4">
          <span className="font-display text-xl text-fg">CSL Menu</span>
          <IconButton aria-label="Close menu" onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
        </div>

        <nav className="mt-5 flex flex-col gap-1" aria-label="Mobile">
          {NAV_ITEMS.map((item) => {
            const active =
              "hash" in item && item.hash
                ? pathname === "/" && hash === item.hash
                : item.to === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.to);

            return (
              <Link
                key={item.label}
                to={item.to}
                hash={"hash" in item ? item.hash : undefined}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-card border border-transparent px-3 py-1.5 text-lg font-medium transition-colors",
                  active
                    ? "border-accent/30 bg-accent text-accent-fg shadow-sm"
                    : "text-muted hover:border-line hover:bg-glass hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-line pt-5">
          {isAdmin ? (
            <Link to="/admin/dashboard" onClick={onClose}>
              <Button variant="surface" className="w-full">
                Admin Dashboard
              </Button>
            </Link>
          ) : null}
          {isAuthenticated ? (
            <Link to="/logout" onClick={onClose}>
              <Button variant="danger" className="w-full">
                <LogOut className="h-4 w-4" />
                Log out
              </Button>
            </Link>
          ) : (
            <Link to="/login" onClick={onClose}>
              <Button className="w-full">
                <LogIn className="h-4 w-4" />
                Login
              </Button>
            </Link>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
