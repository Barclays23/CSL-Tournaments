import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp, CalendarDays, Coins, Flag, ShieldCheck, Trophy, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export type SeasonFormState = {
  seasonNumber: number;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  groupStageEnabled: boolean;
  homeAndAwayFixtures: boolean;
  budgetPerTeam: number;
  playersCount: number;
  seasonTeamCount: number;
  teamSquadSize: number;
  iconPlayerLimit: number;
  goalkeeperLimit: number;
  win: number;
  draw: number;
  loss: number;
  groupStageDrawAllowed: boolean;
  knockoutDrawRequiresShootout: boolean;
  standingsTieBreakers: Array<"points" | "goalDifference" | "goalsScored" | "teamNameAsc">;
};

type Props = {
  value: SeasonFormState;
  onChange: <K extends keyof SeasonFormState>(key: K, value: SeasonFormState[K]) => void;
  mode: "create" | "edit";
  disabled?: boolean;
  identityLocked?: boolean;
  auctionLocked?: boolean;
  matchRulesLocked?: boolean;
};

const tieBreakers = [
  ["points", "Points", "Total points earned"],
  ["goalDifference", "Goal difference", "Goals scored minus goals conceded"],
  ["goalsScored", "Goals scored", "Total goals scored"],
  ["teamNameAsc", "Team name (A–Z)", "Alphabetical order as the final tie-breaker"],
] as const;

function Section({ icon: Icon, title, description, children }: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface/60 p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-accent">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg text-fg">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function NumberField({ label, value, min = 0, max, disabled, required, onChange }: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  required?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block min-w-0 text-sm text-fg">
      {label}
      <Input className="mt-1.5" type="number" min={min} max={max} required={required} disabled={disabled}
        value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ToggleField({ label, description, checked, disabled, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 ${disabled ? "opacity-60" : "hover:bg-surface"}`}>
      <input className="mt-0.5 h-4 w-4 shrink-0 accent-accent" type="checkbox" checked={checked} disabled={disabled}
        onChange={(event) => onChange(event.target.checked)} />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>
      </span>
    </label>
  );
}

export function SeasonConfigurationFields({
  value,
  onChange,
  mode,
  disabled = false,
  identityLocked = false,
  auctionLocked = false,
  matchRulesLocked = false,
}: Props) {
  const identityDisabled = disabled || (mode === "edit" && identityLocked);
  const auctionDisabled = disabled || (mode === "edit" && auctionLocked);
  const matchDisabled = disabled || (mode === "edit" && matchRulesLocked);

  return (
    <div className="grid gap-4">
      <Section icon={CalendarDays} title="Season details" description="The identity and schedule of this season edition.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Edition number" value={value.seasonNumber} min={1} required disabled={identityDisabled}
            onChange={(next) => onChange("seasonNumber", next)} />
          <NumberField label="Season year" value={value.year} min={2000} max={2200} required disabled={identityDisabled}
            onChange={(next) => onChange("year", next)} />
          <label className="block min-w-0 text-sm text-fg sm:col-span-2 lg:col-span-1">
            Season name
            <Input className="mt-1.5" required minLength={2} maxLength={100} disabled={identityDisabled}
              value={value.name} onChange={(event) => onChange("name", event.target.value)} />
          </label>
          <label className="block min-w-0 text-sm text-fg">
            Start date
            <Input className="mt-1.5" type="date" disabled={disabled} value={value.startDate}
              onChange={(event) => onChange("startDate", event.target.value)} />
          </label>
          <label className="block min-w-0 text-sm text-fg">
            End date
            <Input className="mt-1.5" type="date" disabled={disabled} value={value.endDate}
              onChange={(event) => onChange("endDate", event.target.value)} />
          </label>
        </div>
        {mode === "edit" && identityLocked ? <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-muted">Edition number and year are locked because this season has left Draft or has dependent setup records.</p> : null}
      </Section>

      <Section icon={Flag} title="Competition format" description="Choose how the competition is structured and how often teams can meet.">
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleField label="Group stage enabled" description="Organise participating teams into groups before knockout rounds." checked={value.groupStageEnabled} disabled={matchDisabled}
            onChange={(next) => onChange("groupStageEnabled", next)} />
          <ToggleField label="Home and away fixtures" description="Allow up to two meetings between a team pair, with the return fixture reversing home and away." checked={value.homeAndAwayFixtures} disabled={matchDisabled}
            onChange={(next) => onChange("homeAndAwayFixtures", next)} />
        </div>
        {mode === "edit" && matchRulesLocked ? <p className="mt-3 text-xs text-muted">Competition format is locked because fixtures already exist.</p> : null}
      </Section>

      <Section icon={Coins} title="Auction settings" description="Set the auction budget, player pool and squad composition limits.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Budget per team (INR)" value={value.budgetPerTeam} min={0} max={100000000} required disabled={auctionDisabled} onChange={(next) => onChange("budgetPerTeam", next)} />
          <NumberField label="Player nominations" value={value.playersCount} min={1} max={500} required disabled={auctionDisabled} onChange={(next) => onChange("playersCount", next)} />
          <NumberField label="Participating team limit" value={value.seasonTeamCount} min={2} max={64} required disabled={auctionDisabled} onChange={(next) => onChange("seasonTeamCount", next)} />
          <NumberField label="Squad size per team" value={value.teamSquadSize} min={1} max={40} required disabled={auctionDisabled} onChange={(next) => onChange("teamSquadSize", next)} />
          <NumberField label="Icon player limit" value={value.iconPlayerLimit} min={0} max={40} required disabled={auctionDisabled} onChange={(next) => onChange("iconPlayerLimit", next)} />
          <NumberField label="Goalkeeper limit" value={value.goalkeeperLimit} min={0} max={40} required disabled={auctionDisabled} onChange={(next) => onChange("goalkeeperLimit", next)} />
        </div>
        {value.iconPlayerLimit > value.teamSquadSize || value.goalkeeperLimit > value.teamSquadSize
          ? <p className="mt-3 text-xs text-danger-fg">Icon player and goalkeeper limits cannot exceed the squad size.</p> : null}
        {mode === "edit" && auctionLocked ? <p className="mt-3 text-xs text-muted">Auction settings are locked because auction lots already exist for this season.</p> : null}
      </Section>

      <Section icon={Trophy} title="Points system" description="Define the points awarded for each match result.">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField label="Win points" value={value.win} min={0} required disabled={matchDisabled} onChange={(next) => onChange("win", next)} />
          <NumberField label="Draw points" value={value.draw} min={0} required disabled={matchDisabled} onChange={(next) => onChange("draw", next)} />
          <NumberField label="Loss points" value={value.loss} min={0} required disabled={matchDisabled} onChange={(next) => onChange("loss", next)} />
        </div>
      </Section>

      <Section icon={ShieldCheck} title="Match and standings rules" description="Configure match outcomes and decide how teams are ranked when they finish level on points.">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Match outcomes</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleField label="Allow draws in group-stage matches" description="When enabled, group-stage matches may finish level." checked={value.groupStageDrawAllowed} disabled={matchDisabled}
              onChange={(next) => onChange("groupStageDrawAllowed", next)} />
            <ToggleField label="Require a shootout for tied knockout matches" description="A tied knockout match must be decided by a penalty shootout." checked={value.knockoutDrawRequiresShootout} disabled={matchDisabled}
              onChange={(next) => onChange("knockoutDrawRequiresShootout", next)} />
          </div>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-fg">Standings tiebreaker priority</h4>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">Selected criteria are applied from top to bottom. Use the arrows to change their priority.</p>
            </div>
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">
              {value.standingsTieBreakers.length} selected
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {tieBreakers.map(([key, label, description]) => {
              const selectedIndex = value.standingsTieBreakers.indexOf(key);
              const selected = selectedIndex >= 0;
              const movePriority = (direction: -1 | 1) => {
                const targetIndex = selectedIndex + direction;
                if (selectedIndex < 0 || targetIndex < 0 || targetIndex >= value.standingsTieBreakers.length) return;
                const next = [...value.standingsTieBreakers];
                [next[selectedIndex], next[targetIndex]] = [next[targetIndex], next[selectedIndex]];
                onChange("standingsTieBreakers", next);
              };

              return (
                <div key={key} className={`flex min-w-0 items-center gap-2 rounded-xl border p-3 transition-colors ${selected ? "border-accent/40 bg-primary/5" : "border-line hover:bg-surface"}`}>
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                    <input className="mt-1 h-4 w-4 shrink-0 accent-accent" type="checkbox" checked={selected} disabled={matchDisabled}
                      onChange={(event) => onChange("standingsTieBreakers", event.target.checked
                        ? [...value.standingsTieBreakers, key]
                        : value.standingsTieBreakers.filter((item) => item !== key))} />
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${selected ? "bg-primary/15 text-accent" : "bg-surface text-muted"}`}>
                      {selected ? selectedIndex + 1 : "–"}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-fg">{label}</span>
                      <span className="mt-0.5 block text-xs text-muted">{description}</span>
                    </span>
                  </label>
                  {selected ? (
                    <div className="flex shrink-0 flex-col gap-1">
                      <button type="button" aria-label={`Move ${label} up`} title="Move up"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-muted transition hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:opacity-35"
                        disabled={matchDisabled || selectedIndex === 0} onClick={() => movePriority(-1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" aria-label={`Move ${label} down`} title="Move down"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-muted transition hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:opacity-35"
                        disabled={matchDisabled || selectedIndex === value.standingsTieBreakers.length - 1} onClick={() => movePriority(1)}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!value.standingsTieBreakers.length ? <p className="mt-2 text-xs text-danger">Select at least one tiebreaker.</p> : null}
        </div>
        {mode === "edit" && matchRulesLocked ? <p className="mt-3 text-xs text-muted">Match and standings rules are locked because fixtures already exist.</p> : null}
      </Section>      </Section>
    </div>
  );
}

type SeasonConfigurationFormProps = Props & {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  submitDisabled?: boolean;
};

export function SeasonConfigurationForm({
  onSubmit,
  submitLabel,
  submitDisabled = false,
  ...fields
}: SeasonConfigurationFormProps) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <SeasonConfigurationFields {...fields} />
      </div>
      <div className="flex justify-end border-t border-line pt-3">
        <Button type="submit" disabled={fields.disabled || submitDisabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
