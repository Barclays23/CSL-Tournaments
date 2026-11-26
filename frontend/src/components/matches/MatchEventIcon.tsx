import { Goal } from "lucide-react";
import { IoFootball } from "react-icons/io5";
import { MdSportsSoccer } from "react-icons/md";
import { TbRectangleVerticalFilled } from "react-icons/tb";

export type MatchEventKind = "goal" | "own_goal" | "yellow_card" | "red_card" | "second_yellow";

const LABELS: Record<MatchEventKind, string> = {
  goal: "Goal",
  own_goal: "Own goal",
  yellow_card: "Yellow card",
  red_card: "Red card",
  second_yellow: "Second yellow card",
};

/**
 * Shared match-event iconography.
 * Uses the project's existing lucide-react dependency and theme colour tokens.
 */
export function MatchEventIcon({
  kind,
  className = "h-5 w-5",
}: {
  kind: MatchEventKind;
  className?: string;
}) {
  const label = LABELS[kind];

  const icon = (() => {
    switch (kind) {
      case "goal":
        // return <IoFootball className={className} aria-hidden="true" />;
        return <MdSportsSoccer className={className} aria-hidden="true" />;
      case "own_goal":
        return <MdSportsSoccer className={className} aria-hidden="true" />;
      case "yellow_card":
        return <TbRectangleVerticalFilled className={className} fill="currentColor" aria-hidden="true" />;
      case "red_card":
        return <TbRectangleVerticalFilled className={className} fill="currentColor" aria-hidden="true" />;
      case "second_yellow":
        return (
          <span className={`relative inline-flex ${className}`} aria-hidden="true">
            <TbRectangleVerticalFilled className="absolute left-0 top-0 h-[85%] w-[85%] fill-warning text-warning" />
            <TbRectangleVerticalFilled className="absolute bottom-0 right-0 h-[85%] w-[85%] fill-danger text-danger [stroke:var(--csl-bg)]" />
          </span>
        );
    }
  })();

  const tone = kind === "goal"
    ? "text-fg"
    : kind === "own_goal" || kind === "red_card"
      ? "text-danger"
      : kind === "yellow_card"
        ? "text-warning"
        : "";

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 ${tone}`}
    >
      {icon}
    </span>
  );
}
