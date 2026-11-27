import { useEffect, useMemo } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Hash, Info, StickyNote, Swords, Users } from "lucide-react";
import { FieldError } from "@/components/forms/FieldError";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { Season, SeasonTeam } from "@/types/season.types";
import type { SeasonGroup, SeasonMatch, SeasonMatchStage, SeasonMatchWrite } from "@/types/seasonMatch.types";
import { fromDateTimeInput, toDateTimeInput } from "@/utils/formatDate";
import { refId } from "@/utils/refs";
import { seasonMatchFormSchema, type SeasonMatchFormInput, type SeasonMatchFormValues } from "@/schemas/seasonMatch.schema";
import type { Venue } from "@/types/venue.types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { TONES, ToneSection } from "@/lib/tones/Tones";


const STAGES: Array<{ value: SeasonMatchStage; label: string }> = [
  { value: "group", label: "Group stage" },
  { value: "round_of_16", label: "Round of 16" },
  { value: "quarter_final", label: "Quarter-final" },
  { value: "semi_final", label: "Semi-final" },
  { value: "third_place", label: "Third-place playoff" },
  { value: "final", label: "Final" },
];

type SeasonMatchFormField =
  | "matchNumber"
  | "roundNumber"
  | "stage"
  | "groupRef"
  | "kickoffAt"
  | "venueRef"
  | "homeSeasonTeamRef"
  | "awaySeasonTeamRef"
  | "notes"
  | "matchDurationMinutes";

const FORM_FIELD_NAMES: readonly SeasonMatchFormField[] = [
  "matchNumber",
  "roundNumber",
  "stage",
  "groupRef",
  "kickoffAt",
  "venueRef",
  "homeSeasonTeamRef",
  "awaySeasonTeamRef",
  "notes",
  "matchDurationMinutes",
];

function isSeasonMatchFormField(field: string): field is SeasonMatchFormField {
  return (FORM_FIELD_NAMES as readonly string[]).includes(field);
}

function getDefaultValues(match?: SeasonMatch | null, season?: Season | null): SeasonMatchFormInput {
  const existingVenueRef = match?.venueRef;
  return {
    matchNumber: match?.matchNumber ?? "",
    roundNumber: match?.roundNumber ?? 1,
    stage: (match?.stage ?? "") as SeasonMatchFormInput["stage"],
    groupRef: match?.groupRef ?? "",
    kickoffAt: match ? toDateTimeInput(match.kickoffAt) : "",
    venueRef: existingVenueRef && typeof existingVenueRef === "object" ? existingVenueRef._id : existingVenueRef ?? "",
    homeSeasonTeamRef: refId(match?.homeSeasonTeamRef) ?? "",
    awaySeasonTeamRef: refId(match?.awaySeasonTeamRef) ?? "",
    notes: match?.notes ?? "",
    matchDurationMinutes: match?.matchDurationMinutes ?? season?.matchRules?.defaultMatchDurationMinutes ?? 30,
    extraTimeIsAllowed: match?.decidingRules.extraTime.isAllowed ?? season?.matchRules?.extraTime.isAllowedByDefault ?? false,
    extraTimeDurationMinutes: match?.decidingRules.extraTime.durationMinutes ?? season?.matchRules?.extraTime.defaultDurationMinutes ?? 10,
    penaltyShootoutIsAllowed: match?.decidingRules.penaltyShootout.isAllowed ?? season?.matchRules?.penaltyShootout.isAllowedByDefault ?? false,
  };
}

const EMPTY_FORM_VALUES = getDefaultValues(null);

export function SeasonMatchForm({
  season,
  seasonTeams,
  groups,
  venues,
  match,
  submitting,
  onSubmit,
}: {
  season: Season | null | undefined;
  seasonTeams: SeasonTeam[];
  groups: SeasonGroup[];
  venues: Venue[];
  match?: SeasonMatch | null;
  submitting: boolean;
  onSubmit: (values: SeasonMatchWrite) => Promise<void>;
}) {
  const defaultValues = useMemo(() => getDefaultValues(match, season), [match, season]);
  const {
    control,
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<SeasonMatchFormInput, unknown, SeasonMatchFormValues>({
    resolver: zodResolver(seasonMatchFormSchema),
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onChange",
    shouldFocusError: true,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const stage = watch("stage");
  const groupRef = watch("groupRef") ?? "";
  const homeTeamRef = watch("homeSeasonTeamRef") ?? "";

  useEffect(() => {
    if (stage === "group") {
      setValue("extraTimeIsAllowed", false, { shouldValidate: true });
      setValue("penaltyShootoutIsAllowed", false, { shouldValidate: true });
    }
  }, [stage, setValue]);

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
    const allowed = new Set(
      eligibleTeams.filter((team) => team.groupRef === nextGroup).map((team) => team._id),
    );

    if (!allowed.has(getValues("homeSeasonTeamRef"))) {
      setValue("homeSeasonTeamRef", "", { shouldDirty: true, shouldValidate: true });
    }
    if (!allowed.has(getValues("awaySeasonTeamRef"))) {
      setValue("awaySeasonTeamRef", "", { shouldDirty: true, shouldValidate: true });
    }
  };

  const submitForm = async (values: SeasonMatchFormValues) => {
    clearErrors("root.serverError");

    try {
      await onSubmit({
        matchNumber: values.matchNumber,
        roundNumber: values.roundNumber,
        stage: values.stage,
        groupRef: values.stage === "group" ? values.groupRef : null,
        ...(match?.status === "postponed" ? {} : { kickoffAt: fromDateTimeInput(values.kickoffAt) }),
        venueRef: values.venueRef,
        homeSeasonTeamRef: values.homeSeasonTeamRef,
        awaySeasonTeamRef: values.awaySeasonTeamRef,
        notes: values.notes,
        matchDurationMinutes: values.matchDurationMinutes,
        ...(!match ? {
          decidingRules: {
            extraTime: { isAllowed: values.stage === "group" ? false : values.extraTimeIsAllowed, durationMinutes: values.extraTimeDurationMinutes },
            penaltyShootout: { isAllowed: values.stage === "group" ? false : values.penaltyShootoutIsAllowed },
          },
        } : {}),
      });

      if (!match) reset(EMPTY_FORM_VALUES);
    } catch (error) {
      const apiError = error as { fieldErrors?: Record<string, string>; message?: string };
      const fieldErrors = apiError.fieldErrors ?? {};
      let mappedFields = 0;
      const unmappedErrors: string[] = [];

      for (const [field, message] of Object.entries(fieldErrors)) {
        if (isSeasonMatchFormField(field)) {
          setError(field as FieldPath<SeasonMatchFormInput>, { type: "server", message });
          mappedFields += 1;
        } else {
          unmappedErrors.push(message);
        }
      }

      if (mappedFields === 0 || unmappedErrors.length > 0) {
        setError("root.serverError", {
          type: "server",
          message: unmappedErrors[0] || apiError.message || "Unable to save fixture. Please try again.",
        });
      }

      throw error;
    }
  };

  const rootError = errors.root?.serverError?.message;

  return (
    <form
      className="grid gap-4"
      noValidate
      aria-busy={submitting}
      onSubmit={handleSubmit(submitForm)}
    >
      {/* Match details */}
      <ToneSection
        tone="info"
        icon={<Hash className="h-4 w-4" />}
        title="Match details"
        description="Number, round and stage of this fixture."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Match number" required>
            <Input
              {...register("matchNumber")}
              className={TONES.info.input}
              type="number"
              min={1}
              max={100}
              required
              placeholder="1"
              aria-invalid={Boolean(errors.matchNumber)}
            />
            <FieldError message={errors.matchNumber?.message} />
          </FormField>
          <FormField label="Round number" required>
            <Input
              {...register("roundNumber")}
              className={TONES.info.input}
              type="number"
              min={1}
              max={50}
              required
              aria-invalid={Boolean(errors.roundNumber)}
            />
            <FieldError message={errors.roundNumber?.message} />
          </FormField>
          <FormField label="Stage" required>
            <Controller
              name="stage"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  className={TONES.info.input}
                  value={field.value || ""}
                  aria-invalid={Boolean(errors.stage)}
                  onChange={(event) => {
                    const nextStage = event.target.value as SeasonMatchFormInput["stage"];
                    field.onChange(nextStage);

                    if (nextStage !== stage) {
                      setValue("groupRef", "", { shouldDirty: true, shouldValidate: true });
                      setValue("homeSeasonTeamRef", "", { shouldDirty: true, shouldValidate: true });
                      setValue("awaySeasonTeamRef", "", { shouldDirty: true, shouldValidate: true });
                    }
                  }}
                >
                  <option value="">Choose stage</option>
                  {STAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              )}
            />
            <FieldError message={errors.stage?.message} />
          </FormField>
        </div>
      </ToneSection>

      {/* Group (group stage only) */}
      {stage === "group" ? (
        <ToneSection
          tone="accent"
          icon={<Users className="h-4 w-4" />}
          title="Group"
          description="Only teams from this group can be picked."
        >
          <FormField label="Group" required>
            <Controller
              name="groupRef"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  className={TONES.accent.input}
                  value={field.value ?? ""}
                  required
                  aria-invalid={Boolean(errors.groupRef)}
                  onChange={(event) => {
                    const nextGroup = event.target.value;
                    field.onChange(nextGroup);
                    changeGroup(nextGroup);
                  }}
                >
                  <option value="">Choose a group</option>
                  {groups.map((group) => <option key={group._id} value={group._id}>{group.groupName}</option>)}
                </Select>
              )}
            />
            <FieldError message={errors.groupRef?.message} />
          </FormField>
        </ToneSection>
      ) : null}

      {/* Schedule & venue */}
      <ToneSection
        tone="gold"
        icon={<CalendarClock className="h-4 w-4" />}
        title="Schedule & venue"
        description="When and where the match is played."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Kick-off" required>
            <Input
              {...register("kickoffAt")}
              className={TONES.gold.input}
              type="datetime-local"
              required
              readOnly={match?.status === "postponed"}
              aria-invalid={Boolean(errors.kickoffAt)}
            />
            <FieldError message={errors.kickoffAt?.message} />
          </FormField>
          <FormField label="Venue / Ground" required>
            <Controller
              name="venueRef"
              control={control}
              render={({ field }) => (
                <Select {...field} className={TONES.gold.input} required aria-invalid={Boolean(errors.venueRef)}>
                  <option value="">Choose a venue</option>
                  {venues.filter((venue) => venue.status === "active").map((venue) => (
                    <option key={venue._id} value={venue._id}>
                      {venue.name}{venue.location ? " · " + venue.location : ""}
                    </option>
                  ))}
                  {field.value && !venues.some((venue) => venue._id === field.value && venue.status === "active")
                    ? <option value={field.value} disabled>{typeof match?.venueRef === "object" ? match.venueRef.name : "Inactive venue"} · Inactive</option>
                    : null}
                </Select>
              )}
            />
            <FieldError message={errors.venueRef?.message} />
          </FormField>
          <FormField label="Regular Match duration (minutes)" required>
            <Input {...register("matchDurationMinutes")} className={TONES.gold.input} type="number" min={10} max={120} step={2}
              readOnly={Boolean(match?.actualStartedAt)} aria-invalid={Boolean(errors.matchDurationMinutes)} />
            <FieldError message={errors.matchDurationMinutes?.message} />
            <p className="mt-1 text-xs text-muted">Even whole number from 10 to 120 minutes. Season default: {season?.matchRules?.defaultMatchDurationMinutes ?? "Not configured"} minutes.</p>
          </FormField>
        </div>

        {match?.status === "postponed" ? (
          <p className={"flex items-start gap-2 rounded-xl border p-2.5 text-xs leading-relaxed " + TONES.gold.note}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>The original kick-off is preserved. Use Reschedule Match in the status manager to set a new date and time.</span>
          </p>
        ) : null}
      </ToneSection>

      {!match ? (
        <ToneSection tone="accent" icon={<Info className="h-4 w-4" />} title="Initial Match Deciding Rules"
          description="Review the Season defaults copied into this fixture. Later changes are made from Match Details.">
          {stage === "group" ? (
            <p className={"rounded-xl border p-3 text-xs leading-relaxed " + TONES.accent.note}>
              Group Stage fixtures always have Extra Time and Penalty Shootout disabled. Both settings are saved as false.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Controller name="extraTimeIsAllowed" control={control} render={({ field }) => (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
                  <input type="checkbox" className="mt-1 accent-accent" checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />
                  <span><span className="block text-sm font-semibold text-fg">Allow Extra Time</span><span className="block text-xs text-muted">Season default: {season?.matchRules?.extraTime.isAllowedByDefault ? "Enabled" : "Disabled"}</span></span>
                </label>
              )} />
              <Controller name="penaltyShootoutIsAllowed" control={control} render={({ field }) => (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
                  <input type="checkbox" className="mt-1 accent-accent" checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />
                  <span><span className="block text-sm font-semibold text-fg">Allow Penalty Shootout</span><span className="block text-xs text-muted">Season default: {season?.matchRules?.penaltyShootout.isAllowedByDefault ? "Enabled" : "Disabled"}</span></span>
                </label>
              )} />
              <FormField label="Extra Time duration (minutes)" required>
                <Input {...register("extraTimeDurationMinutes")} type="number" min={2} step={2} className={TONES.accent.input} aria-invalid={Boolean(errors.extraTimeDurationMinutes)} />
                <FieldError message={errors.extraTimeDurationMinutes?.message} />
                <p className="mt-1 text-xs text-muted">Season default: {season?.matchRules?.extraTime.defaultDurationMinutes ?? "Not configured"} minutes. Positive even whole number; no upper limit is imposed.</p>
              </FormField>
            </div>
          )}
        </ToneSection>
      ) : null}

      {/* Teams */}
      <ToneSection
        tone="primary"
        icon={<Swords className="h-4 w-4" />}
        title="Teams"
        description="Choose the home and away sides."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Home team" required>
            <Controller
              name="homeSeasonTeamRef"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  className={TONES.primary.input}
                  disabled={!stage || (stage === "group" && !groupRef)}
                  aria-invalid={Boolean(errors.homeSeasonTeamRef)}
                >
                  <option value="">
                    {stage === "group" && !groupRef ? "Choose a group first" : "Choose home team"}
                  </option>
                  {selectableTeams.map((team) => (
                    <option key={team._id} value={team._id}>{team.displayName}</option>
                  ))}
                </Select>
              )}
            />
            <FieldError message={errors.homeSeasonTeamRef?.message} />
          </FormField>
          <FormField label="Away team" required>
            <Controller
              name="awaySeasonTeamRef"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  className={TONES.primary.input}
                  disabled={!stage || (stage === "group" && !groupRef)}
                  aria-invalid={Boolean(errors.awaySeasonTeamRef)}
                >
                  <option value="">
                    {stage === "group" && !groupRef ? "Choose a group first" : "Choose away team"}
                  </option>
                  {selectableTeams.filter((team) => team._id !== homeTeamRef).map((team) => (
                    <option key={team._id} value={team._id}>{team.displayName}</option>
                  ))}
                </Select>
              )}
            />
            <FieldError message={errors.awaySeasonTeamRef?.message} />
          </FormField>
        </div>
      </ToneSection>

      {/* Notes */}
      <ToneSection
        tone="success"
        icon={<StickyNote className="h-4 w-4" />}
        title="Notes"
        description="Optional details about this fixture."
      >
        <FormField label="Notes">
          <Textarea
            {...register("notes")}
            className={TONES.success.input}
            maxLength={1000}
            placeholder="Optional fixture notes"
            aria-invalid={Boolean(errors.notes)}
          />
          <FieldError message={errors.notes?.message} />
        </FormField>
      </ToneSection>

      {rootError ? (
        <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
          {rootError}
        </p>
      ) : null}

      <p className={"flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed " + TONES.info.note}>
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {match
            ? "Editing fixture details does not change its recorded goals or current result."
            : "The fixture is created as scheduled. Record goals and update its status from its match page."}
        </span>
      </p>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : match ? "Save changes" : "Save fixture"}
      </Button>

      {submitting && (
        <LoadingSpinner
          label={match ? "Saving changes..." : "Creating fixture..."}
          size="md"
          mode="cover"
        />
      )}
    </form>
  );
}