import { useMemo, useState, type FormEvent } from "react";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { SeasonTeam } from "@/types/season.types";
import type { SeasonGroup, SeasonMatchStage, SeasonMatchWrite } from "@/types/seasonMatch.types";
import { fromDateTimeInput } from "@/utils/formatDate";

const STAGES: Array<{ value: SeasonMatchStage; label: string }> = [
  { value: "group", label: "Group stage" },
  { value: "round_of_16", label: "Round of 16" },
  { value: "quarter_final", label: "Quarter-final" },
  { value: "semi_final", label: "Semi-final" },
  { value: "third_place", label: "Third-place playoff" },
  { value: "final", label: "Final" },
];

export function SeasonMatchForm({
  seasonTeams,
  groups,
  submitting,
  onSubmit,
}: {
  seasonTeams: SeasonTeam[];
  groups: SeasonGroup[];
  submitting: boolean;
  onSubmit: (values: SeasonMatchWrite) => Promise<void>;
}) {
  const [stage, setStage] = useState<SeasonMatchStage | "">("");
  const [groupRef, setGroupRef] = useState("");
  const [homeTeamRef, setHomeTeamRef] = useState("");
  const [awayTeamRef, setAwayTeamRef] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");

  const eligibleTeams = useMemo(
    () => seasonTeams.filter((team) => ["registered", "active"].includes(team.status)),
    [seasonTeams],
  );
  const selectableTeams = useMemo(
    () => stage === "group"
      ? eligibleTeams.filter((team) => team.groupRef === groupRef && Boolean(groupRef))
      : eligibleTeams,
    [eligibleTeams, groupRef, stage],
  );

  const changeGroup = (nextGroup: string) => {
    setGroupRef(nextGroup);
    const allowed = new Set(eligibleTeams.filter((team) => team.groupRef === nextGroup).map((team) => team._id));
    if (!allowed.has(homeTeamRef)) setHomeTeamRef("");
    if (!allowed.has(awayTeamRef)) setAwayTeamRef("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const nextErrors: Record<string, string> = {};
    const matchNumber = Number(data.get("matchNumber"));
    const kickoffAt = String(data.get("kickoffAt") ?? "");
    const venue = String(data.get("venue") ?? "").trim();
    const notes = String(data.get("notes") ?? "").trim();

    if (!Number.isInteger(matchNumber) || matchNumber < 1 || matchNumber > 9999) nextErrors.matchNumber = "Enter a match number between 1 and 9999.";
    if (!stage) nextErrors.stage = "Choose a match stage.";
    if (stage === "group" && !groupRef) nextErrors.groupRef = "Choose a group for a group-stage fixture.";
    if (!kickoffAt || Number.isNaN(new Date(kickoffAt).getTime())) nextErrors.kickoffAt = "Enter a valid kick-off date and time.";
    if (venue.length > 160) nextErrors.venue = "Venue must be 160 characters or fewer.";
    if (!homeTeamRef) nextErrors.homeSeasonTeamRef = "Choose the home team.";
    if (!awayTeamRef) nextErrors.awaySeasonTeamRef = "Choose the away team.";
    if (homeTeamRef && awayTeamRef && homeTeamRef === awayTeamRef) nextErrors.awaySeasonTeamRef = "Home and away teams must be different.";
    if (homeTeamRef && !selectableTeams.some((team) => team._id === homeTeamRef)) nextErrors.homeSeasonTeamRef = "Choose an eligible team for this stage and group.";
    if (awayTeamRef && !selectableTeams.some((team) => team._id === awayTeamRef)) nextErrors.awaySeasonTeamRef = "Choose an eligible team for this stage and group.";
    if (notes.length > 1000) nextErrors.notes = "Notes must be 1000 characters or fewer.";
    setErrors(nextErrors);
    setSubmitError("");
    if (Object.keys(nextErrors).length) return;

    try {
      await onSubmit({
        matchNumber,
        stage: stage as SeasonMatchStage,
        groupRef: stage === "group" ? groupRef : null,
        kickoffAt: fromDateTimeInput(kickoffAt),
        venue: venue || null,
        homeSeasonTeamRef: homeTeamRef,
        awaySeasonTeamRef: awayTeamRef,
        status: "scheduled",
        notes: notes || null,
      });
      form.reset();
      setStage("");
      setGroupRef("");
      setHomeTeamRef("");
      setAwayTeamRef("");
      setErrors({});
    } catch (error) {
      const response = (error as { response?: { data?: { details?: Record<string, unknown>; message?: string } } })?.response?.data;
      const details = response?.details;
      if (details && typeof details === "object") {
        const mapped: Record<string, string> = {};
        for (const [field, message] of Object.entries(details)) {
          if (typeof message === "string") mapped[field] = message;
        }
        setErrors(mapped);
      }
      setSubmitError(response?.message || (error instanceof Error ? error.message : "Unable to save fixture. Please review the fields and try again."));
    }
  };

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Match number" required error={errors.matchNumber}>
          <Input name="matchNumber" type="number" min={1} max={9999} required placeholder="1" aria-invalid={Boolean(errors.matchNumber)} />
        </FormField>
        <FormField label="Stage" required error={errors.stage}>
          <Select name="stage" value={stage} aria-invalid={Boolean(errors.stage)} onChange={(event) => {
            const next = event.target.value as SeasonMatchStage | "";
            setStage(next);
            setErrors((current) => ({ ...current, stage: "", groupRef: "", homeSeasonTeamRef: "", awaySeasonTeamRef: "" }));
            if (next !== "group") setGroupRef("");
            setHomeTeamRef("");
            setAwayTeamRef("");
          }}>
            <option value="">Choose stage</option>
            {STAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </FormField>
      </div>
      {stage === "group" ? (
        <FormField label="Group" required error={errors.groupRef}>
          <Select name="groupRef" required value={groupRef} aria-invalid={Boolean(errors.groupRef)} onChange={(event) => changeGroup(event.target.value)}>
            <option value="">Choose a group</option>
            {groups.map((group) => <option key={group._id} value={group._id}>{group.groupName}</option>)}
          </Select>
        </FormField>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Kick-off" required error={errors.kickoffAt}>
          <Input name="kickoffAt" type="datetime-local" required aria-invalid={Boolean(errors.kickoffAt)} />
        </FormField>
        <FormField label="Venue" error={errors.venue}>
          <Input name="venue" maxLength={160} placeholder="Cherukunnu Municipal Ground" aria-invalid={Boolean(errors.venue)} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Home team" required error={errors.homeSeasonTeamRef}>
          <Select name="homeSeasonTeamRef" required value={homeTeamRef} disabled={!stage || (stage === "group" && !groupRef)} aria-invalid={Boolean(errors.homeSeasonTeamRef)} onChange={(event) => setHomeTeamRef(event.target.value)}>
            <option value="">{stage === "group" && !groupRef ? "Choose a group first" : "Choose home team"}</option>
            {selectableTeams.map((team) => <option key={team._id} value={team._id}>{team.displayName}</option>)}
          </Select>
        </FormField>
        <FormField label="Away team" required error={errors.awaySeasonTeamRef}>
          <Select name="awaySeasonTeamRef" required value={awayTeamRef} disabled={!stage || (stage === "group" && !groupRef)} aria-invalid={Boolean(errors.awaySeasonTeamRef)} onChange={(event) => setAwayTeamRef(event.target.value)}>
            <option value="">{stage === "group" && !groupRef ? "Choose a group first" : "Choose away team"}</option>
            {selectableTeams.filter((team) => team._id !== homeTeamRef).map((team) => <option key={team._id} value={team._id}>{team.displayName}</option>)}
          </Select>
        </FormField>
      </div>
      <FormField label="Notes" error={errors.notes}>
        <Textarea name="notes" maxLength={1000} placeholder="Optional fixture notes" aria-invalid={Boolean(errors.notes)} />
      </FormField>
      {submitError ? <p className="text-sm text-danger" role="alert">{submitError}</p> : null}
      <p className="text-xs text-muted">The fixture is created as scheduled. Record goals and update its status from its match page.</p>
      <Button type="submit" disabled={submitting || !stage || eligibleTeams.length < 2 || (stage === "group" && (groups.length === 0 || !groupRef))}>
        {submitting ? "Saving…" : "Save fixture"}
      </Button>
    </form>
  );
}
