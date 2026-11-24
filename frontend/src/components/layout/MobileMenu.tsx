import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, X } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/userNavItems";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useAuth } from "@/contexts/AuthContext";

export function MobileMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isAuthenticated, isAdmin } = useAuth();

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
    <div className="fixed inset-0 z-[100] lg:hidden">
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
        className="absolute inset-y-0 right-0 z-10 flex w-[min(22rem,88vw)] max-w-full flex-col overflow-y-auto overscroll-y-contain border-l border-line bg-surface p-5 shadow-glass"
      >
        <div className="flex items-center justify-between border-b border-line pb-4">
          <span className="font-display text-xl text-fg">CSL Menu</span>
          <IconButton aria-label="Close menu" onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
        </div>

        <nav className="mt-5 flex flex-col gap-2" aria-label="Mobile">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              hash={"hash" in item ? item.hash : undefined}
              onClick={onClose}
              className="rounded-card border border-transparent px-3 py-3 text-lg font-medium text-fg transition-colors hover:border-line hover:bg-glass"
            >
              {item.label}
            </Link>
          ))}
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
