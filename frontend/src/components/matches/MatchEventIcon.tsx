import type { SVGProps } from "react";

export type MatchEventKind = "goal" | "own_goal" | "yellow_card" | "red_card" | "second_yellow";

type IconProps = SVGProps<SVGSVGElement>;

function FootballIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.6l3.8 2.8-1.45 4.4h-4.7L8.2 10.4z" fill="currentColor" />
      <path
        d="M12 7.6V2.8M15.8 10.4l4.5-1.5M14.35 14.8l2.8 3.9M9.65 14.8l-2.8 3.9M8.2 10.4L3.7 8.9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CardIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect x="6.5" y="3" width="11" height="18" rx="2.2" fill="currentColor" />
    </svg>
  );
}

function SecondYellowIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect x="3.5" y="4" width="10" height="16" rx="2" className="text-warning" fill="currentColor" />
      <rect x="10.5" y="4" width="10" height="16" rx="2" className="text-danger" fill="currentColor" stroke="var(--csl-bg)" strokeWidth="1.2" />
    </svg>
  );
}

const LABELS: Record<MatchEventKind, string> = {
  goal: "Goal",
  own_goal: "Own goal",
  yellow_card: "Yellow card",
  red_card: "Red card",
  second_yellow: "Second yellow card",
};

/**
 * Icon for a match event. Colours come from styles.css tokens only.
 * goal -> football (fg), own_goal -> football (danger), cards -> warning / danger.
 */
export function MatchEventIcon({ kind, className = "h-5 w-5" }: { kind: MatchEventKind; className?: string }) {
  const label = LABELS[kind];
  switch (kind) {
    case "goal":
      return <span role="img" aria-label={label} title={label} className="inline-flex text-fg"><FootballIcon className={className} /></span>;
    case "own_goal":
      return <span role="img" aria-label={label} title={label} className="inline-flex text-danger"><FootballIcon className={className} /></span>;
    case "yellow_card":
      return <span role="img" aria-label={label} title={label} className="inline-flex text-warning"><CardIcon className={className} /></span>;
    case "red_card":
      return <span role="img" aria-label={label} title={label} className="inline-flex text-danger"><CardIcon className={className} /></span>;
    case "second_yellow":
      return <span role="img" aria-label={label} title={label} className="inline-flex"><SecondYellowIcon className={className} /></span>;
  }
}