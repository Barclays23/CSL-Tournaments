import { cn } from "@/lib/cn";

export function Tabs({
  tabs,
  value,
  onChange,
  variant = "default",
  ariaLabel,
}: {
  tabs: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  variant?: "default" | "switcher";
  ariaLabel?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto pb-1",
        variant === "switcher" ? "rounded-xl border border-line bg-glass p-1.5" : "",
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              "h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition",
              variant === "switcher" ? "flex-1 focus-visible:outline-2 focus-visible:outline-accent" : "",
              selected
                ? "bg-accent text-accent-fg shadow-sm"
                : "border border-line bg-glass text-fg hover:border-accent/40 hover:bg-surface",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
