import { useMemo, useState, type FormEvent } from "react";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { SeasonTeam } from "@/types/season.types";
import type { SeasonGroup, SeasonMatch, SeasonMatchStage, SeasonMatchWrite } from "@/types/seasonMatch.types";
import { fromDateTimeInput, toDateTimeInput } from "@/utils/formatDate";
import { refId } from "@/utils/refs";
import { seasonMatchFormSchema } from "@/schemas/seasonMatch.schema";
import type { Venue } from "@/types/venue.types";

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
  venues,
  match,
  submitting,
  onSubmit,
}: {
  seasonTeams: SeasonTeam[];
  groups: SeasonGroup[];
  venues: Venue[];
  match?: SeasonMatch | null;
  submitting: boolean;
  onSubmit: (values: SeasonMatchWrite) => Promise<void>;
}) {
  const [stage, setStage] = useState<SeasonMatchStage | "">(match?.stage ?? "");
  const existingVenueRef = match?.venueRef;
  const [venueRef, setVenueRef] = useState(typeof existingVenueRef === "object" ? existingVenueRef._id : existingVenueRef ?? "");
  const [groupRef, setGroupRef] = useState(match?.groupRef ?? "");
  const [homeTeamRef, setHomeTeamRef] = useState(refId(match?.homeSeasonTeamRef) ?? "");
  const [awayTeamRef, setAwayTeamRef] = useState(refId(match?.awaySeasonTeamRef) ?? "");
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
    const raw = {
      matchNumber: data.get("matchNumber"),
      roundNumber: data.get("roundNumber"),
      stage,
      groupRef: stage === "group" ? groupRef : "",
      kickoffAt: String(data.get("kickoffAt") ?? ""),
      venueRef,
      homeSeasonTeamRef: homeTeamRef,
      awaySeasonTeamRef: awayTeamRef,
      notes: String(data.get("notes") ?? ""),
    };
    const parsed = seasonMatchFormSchema.safeParse(raw);
    const nextErrors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        nextErrors[key] ??= issue.message;
      }
    }
    setErrors(nextErrors);
    setSubmitError("");
    if (!parsed.success || Object.keys(nextErrors).length) return;

    try {
      const values = parsed.data;
      await onSubmit({
        matchNumber: values.matchNumber,
        roundNumber: values.roundNumber,
        stage: values.stage,
        groupRef: values.stage === "group" ? values.groupRef : null,
        kickoffAt: fromDateTimeInput(values.kickoffAt),
        venueRef: values.venueRef,
        homeSeasonTeamRef: values.homeSeasonTeamRef,
        awaySeasonTeamRef: values.awaySeasonTeamRef,
        ...(match ? {} : { status: "scheduled" as const }),
        notes: values.notes,
      });
      if (!match) {
        form.reset();
        setStage("");
        setGroupRef("");
        setVenueRef("");
        setHomeTeamRef("");
        setAwayTeamRef("");
        setErrors({});
      }
    } catch (error) {
      const apiError = error as { fieldErrors?: Record<string, string>; message?: string };
      if (apiError.fieldErrors) setErrors(apiError.fieldErrors);
      setSubmitError(apiError.message || (error instanceof Error ? error.message : "Unable to save fixture. Please review the fields and try again."));
      throw error;
    }
  };

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Match number" required error={errors.matchNumber}>
          <Input name="matchNumber" type="number" min={1} max={9999} required defaultValue={match?.matchNumber ?? ""} placeholder="1" aria-invalid={Boolean(errors.matchNumber)} />
        </FormField>
        <FormField label="Round number" required error={errors.roundNumber}><Input name="roundNumber" type="number" min={1} max={999} required defaultValue={match?.roundNumber ?? 1} aria-invalid={Boolean(errors.roundNumber)} /></FormField>
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
          <Input name="kickoffAt" type="datetime-local" required defaultValue={match ? toDateTimeInput(match.kickoffAt) : ""} aria-invalid={Boolean(errors.kickoffAt)} />
        </FormField>
        <FormField label="Venue / Ground" required error={errors.venueRef}>
          <Select name="venueRef" required value={venueRef} aria-invalid={Boolean(errors.venueRef)} onChange={(event) => setVenueRef(event.target.value)}>
            <option value="">Choose a venue</option>
            {venues.filter((venue) => venue.status === "active" || venue._id === venueRef).map((venue) => <option key={venue._id} value={venue._id}>{venue.name}{venue.location ? ` · ${venue.location}` : ""}</option>)}
          </Select>
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
        <Textarea name="notes" maxLength={1000} defaultValue={match?.notes ?? ""} placeholder="Optional fixture notes" aria-invalid={Boolean(errors.notes)} />
      </FormField>
      {submitError ? <p className="text-sm text-danger" role="alert">{submitError}</p> : null}
      <p className="text-xs text-muted">{match ? "Editing fixture details does not change its recorded goals or current result." : "The fixture is created as scheduled. Record goals and update its status from its match page."}</p>
      <Button type="submit" disabled={submitting || !stage || eligibleTeams.length < 2 || !venueRef || (stage === "group" && (groups.length === 0 || !groupRef))}>
        {submitting ? "Saving…" : match ? "Save changes" : "Save fixture"}
      </Button>
    </form>
  );
}
