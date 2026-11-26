import type { ReactNode } from "react";

/**
 * Shared accent tones built only from the theme tokens in styles.css
 * (info, gold, primary, success, accent), so they follow light/dark mode.
 * Save as: src/lib/tones.tsx
 *
 * Class strings are written in full so Tailwind can detect them.
 */
export type Tone = "info" | "gold" | "primary" | "success" | "accent";

export const TONES: Record<Tone, {
  section: string; // section border + background
  chip: string; // icon chip
  text: string; // coloured text (titles, small labels)
  labels: string; // tints every <label> inside a section
  input: string; // Input / Select / Textarea border + background
  cardOff: string; // selectable card (unchecked)
  cardOn: string; // selectable card (checked)
  chipOn: string;
  checkOn: string;
  note: string; // small helper/info box
}> = {
  info: {
    section: "border-info/30 bg-info/[0.06]",
    chip: "bg-info/15 text-info",
    text: "text-info",
    labels: "[&_label]:text-info [&_label]:font-semibold",
    input: "border-info/40 focus:border-info bg-info/10",
    cardOff: "border-info/25 bg-info/5 hover:border-info/50",
    cardOn: "border-info/70 bg-info/15",
    chipOn: "bg-info/20 text-info",
    checkOn: "border-info bg-info text-info-fg",
    note: "border-info/30 bg-info/10 text-info",
  },
  gold: {
    section: "border-gold/30 bg-gold/[0.06]",
    chip: "bg-gold/15 text-gold",
    text: "text-gold",
    labels: "[&_label]:text-gold [&_label]:font-semibold",
    input: "border-gold/40 focus:border-gold bg-gold/10",
    cardOff: "border-gold/25 bg-gold/5 hover:border-gold/50",
    cardOn: "border-gold/70 bg-gold/15",
    chipOn: "bg-gold/20 text-gold",
    checkOn: "border-gold bg-gold text-gold-fg",
    note: "border-gold/30 bg-gold/10 text-gold",
  },
  primary: {
    section: "border-primary/40 bg-primary/10",
    chip: "bg-primary/25 text-success",
    text: "text-success",
    labels: "[&_label]:text-success [&_label]:font-semibold",
    input: "border-primary/40 focus:border-primary bg-primary/15",
    cardOff: "border-primary/30 bg-primary/5 hover:border-primary/60",
    cardOn: "border-primary/70 bg-primary/20",
    chipOn: "bg-primary/25 text-success",
    checkOn: "border-primary bg-primary text-primary-fg",
    note: "border-primary/40 bg-primary/10 text-success",
  },
  success: {
    section: "border-success/35 bg-success/10",
    chip: "bg-success/20 text-success",
    text: "text-success",
    labels: "[&_label]:text-success [&_label]:font-semibold",
    input: "border-success/40 focus:border-success bg-success/5",
    cardOff: "border-success/25 bg-success/5 hover:border-success/50",
    cardOn: "border-success/70 bg-success/15",
    chipOn: "bg-success/20 text-success",
    checkOn: "border-success bg-success text-success-fg",
    note: "border-success/35 bg-success/10 text-success",
  },
  accent: {
    section: "border-accent/35 bg-accent/[0.07]",
    chip: "bg-accent/20 text-accent",
    text: "text-accent",
    labels: "[&_label]:text-accent [&_label]:font-semibold",
    input: "border-accent/40 focus:border-accent bg-accent/15",
    cardOff: "border-accent/25 bg-accent/5 hover:border-accent/50",
    cardOn: "border-accent/70 bg-accent/15",
    chipOn: "bg-accent/25 text-accent",
    checkOn: "border-accent bg-accent text-accent-fg",
    note: "border-accent/35 bg-accent/10 text-accent",
  },
};

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
      <div className="flex items-center gap-2.5">
        <span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " + t.chip}>
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          {description ? <p className="text-xs text-muted">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}