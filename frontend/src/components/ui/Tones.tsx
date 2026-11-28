import type { ReactNode } from "react";

/**
 * Shared accent tones built only from the theme tokens in styles.css
 * (info, gold, primary, success, accent), so they follow light/dark mode.
 * Save as: src/components/ui/Tones.tsx
 *
 * Class strings are written in full so Tailwind can detect them.
 */
export type Tone = "info" | "gold" | "primary" | "success" | "accent";

export const TONES: Record<Tone, {
  section: string; // section border + background
  glass: string; // section + glass blur + shadow (top-level cards)
  chip: string; // icon chip
  text: string; // coloured text (titles, small labels)
  labels: string; // tints every <label> inside a section
  input: string; // Input / Select / Textarea border + background
  cardOff: string; // selectable card (unchecked)
  cardOn: string; // selectable card (checked)
  chipOn: string;
  checkOn: string;
  note: string; // small helper/info box
  pill: string; // small badge / meta chip
  iconBtn: string; // small round icon button
  dot: string; // status dot
  divider: string; // border colour for dividers
  glow: string; // soft gradient wash (decorative layer)
}> = {
  info: {
    section: "border-info/30 bg-info/[0.06]",
    glass: "border-info/30 bg-info/[0.06] backdrop-blur-xl shadow-glass",
    chip: "bg-info/15 text-info",
    text: "text-info",
    labels: "[&_label]:text-info [&_label]:font-semibold",
    input: "border-info/40 focus:border-info focus:ring-2 focus:ring-info/25 bg-info/10",
    cardOff: "border-info/25 bg-info/5 hover:border-info/50",
    cardOn: "border-info/70 bg-info/15",
    chipOn: "bg-info/20 text-info",
    checkOn: "border-info bg-info text-info-fg",
    note: "border-info/30 bg-info/10 text-info",
    pill: "border-info/30 bg-info/10 text-info",
    iconBtn: "border-info/30 bg-info/10 text-info hover:bg-info/20",
    dot: "bg-info",
    divider: "border-info/25",
    glow: "bg-gradient-to-br from-info/15 via-transparent to-transparent",
  },
  gold: {
    section: "border-gold/30 bg-gold/[0.06]",
    glass: "border-gold/30 bg-gold/[0.06] backdrop-blur-xl shadow-glass",
    chip: "bg-gold/15 text-gold",
    text: "text-gold",
    labels: "[&_label]:text-gold [&_label]:font-semibold",
    input: "border-gold/40 focus:border-gold focus:ring-2 focus:ring-gold/25 bg-gold/10",
    cardOff: "border-gold/25 bg-gold/5 hover:border-gold/50",
    cardOn: "border-gold/70 bg-gold/15",
    chipOn: "bg-gold/20 text-gold",
    checkOn: "border-gold bg-gold text-gold-fg",
    note: "border-gold/30 bg-gold/10 text-gold",
    pill: "border-gold/30 bg-gold/10 text-gold",
    iconBtn: "border-gold/30 bg-gold/10 text-gold hover:bg-gold/20",
    dot: "bg-gold",
    divider: "border-gold/25",
    glow: "bg-gradient-to-br from-gold/15 via-transparent to-transparent",
  },
  primary: {
    section: "border-primary/40 bg-primary/10",
    glass: "border-primary/40 bg-primary/10 backdrop-blur-xl shadow-glass",
    chip: "bg-primary/25 text-success",
    text: "text-success",
    labels: "[&_label]:text-success [&_label]:font-semibold",
    input: "border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/25 bg-primary/15",
    cardOff: "border-primary/30 bg-primary/5 hover:border-primary/60",
    cardOn: "border-primary/70 bg-primary/20",
    chipOn: "bg-primary/25 text-success",
    checkOn: "border-primary bg-primary text-primary-fg",
    note: "border-primary/40 bg-primary/10 text-success",
    pill: "border-primary/40 bg-primary/15 text-success",
    iconBtn: "border-primary/40 bg-primary/15 text-success hover:bg-primary/25",
    dot: "bg-primary",
    divider: "border-primary/30",
    glow: "bg-gradient-to-br from-primary/25 via-transparent to-transparent",
  },
  success: {
    section: "border-success/35 bg-success/10",
    glass: "border-success/35 bg-success/10 backdrop-blur-xl shadow-glass",
    chip: "bg-success/20 text-success",
    text: "text-success",
    labels: "[&_label]:text-success [&_label]:font-semibold",
    input: "border-success/40 focus:border-success focus:ring-2 focus:ring-success/25 bg-success/5",
    cardOff: "border-success/25 bg-success/5 hover:border-success/50",
    cardOn: "border-success/70 bg-success/15",
    chipOn: "bg-success/20 text-success",
    checkOn: "border-success bg-success text-success-fg",
    note: "border-success/35 bg-success/10 text-success",
    pill: "border-success/35 bg-success/10 text-success",
    iconBtn: "border-success/35 bg-success/10 text-success hover:bg-success/20",
    dot: "bg-success",
    divider: "border-success/25",
    glow: "bg-gradient-to-br from-success/15 via-transparent to-transparent",
  },
  accent: {
    section: "border-accent/35 bg-accent/[0.07]",
    glass: "border-accent/35 bg-accent/[0.07] backdrop-blur-xl shadow-glass",
    chip: "bg-accent/20 text-accent",
    text: "text-accent",
    labels: "[&_label]:text-accent [&_label]:font-semibold",
    input: "border-accent/40 focus:border-accent focus:ring-2 focus:ring-accent/25 bg-accent/15",
    cardOff: "border-accent/25 bg-accent/5 hover:border-accent/50",
    cardOn: "border-accent/70 bg-accent/15",
    chipOn: "bg-accent/25 text-accent",
    checkOn: "border-accent bg-accent text-accent-fg",
    note: "border-accent/35 bg-accent/10 text-accent",
    pill: "border-accent/35 bg-accent/10 text-accent",
    iconBtn: "border-accent/35 bg-accent/10 text-accent hover:bg-accent/20",
    dot: "bg-accent",
    divider: "border-accent/30",
    glow: "bg-gradient-to-br from-accent/15 via-transparent to-transparent",
  },
};

/** Base classes shared by every raw <input>/<select>/<textarea>; pair with TONES[tone].input */
export const FIELD = "rounded-lg border px-3 py-2 text-sm text-fg outline-none transition-colors";

/** Convenience: full field class for a tone, e.g. fieldClass("info", "w-full") */
export function fieldClass(tone: Tone, extra = ""): string {
  return `${FIELD} ${TONES[tone].input} ${extra}`.trim();
}

/** Small inline pill (meta chip / badge) in a tone */
export const pillClass = (tone: Tone) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md ${TONES[tone].pill}`;

/** Common 24px stroke icon paths for <ToneIcon d={...} /> */
export const ICONS = {
  calendar: "M8 3v4M16 3v4M3.5 10h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5z",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  list: "M4 6h16M4 12h16M4 18h10",
  shield: "M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z",
  edit: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z",
  info: "M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  alert: "M12 9v4M12 17h.01M10.3 4.2L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  card: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
  users: "M16 11a3 3 0 1 0 0-6M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3",
  note: "M5 4h14v16H5zM9 9h6M9 13h6",
} as const;

export function ToneSection({
  tone,
  icon,
  title,
  description,
  children,
}: {
  tone: Tone;
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <section className={"grid gap-4 rounded-2xl border p-3 sm:p-4 " + t.section + " " + t.labels}>
      <ToneHeader tone={tone} icon={icon} title={title} description={description} />
      {children}
    </section>
  );
}

/** Icon chip + title (+ description) row. Used inside any tinted section/card. */
export function ToneHeader({
  tone,
  icon,
  title,
  description,
  as: Heading = "h3",
  className = "",
}: {
  tone: Tone;
  icon: ReactNode;
  title: string;
  description?: string;
  as?: "h2" | "h3";
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div className={"flex items-center gap-2.5 " + className}>
      <span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " + t.chip}>
        {icon}
      </span>
      <div className="min-w-0">
        <Heading className={(Heading === "h2" ? "text-lg" : "text-sm") + " font-semibold text-fg"}>{title}</Heading>
        {description ? <p className="text-xs text-muted">{description}</p> : null}
      </div>
    </div>
  );
}

export function ToneIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}