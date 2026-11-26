import { useEffect, useMemo } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { SeasonTeam } from "@/types/season.types";
import type { SeasonGroup, SeasonMatch, SeasonMatchStage, SeasonMatchWrite } from "@/types/seasonMatch.types";
import { fromDateTimeInput, toDateTimeInput } from "@/utils/formatDate";
import { refId } from "@/utils/refs";
import { seasonMatchFormSchema, type SeasonMatchFormInput, type SeasonMatchFormValues } from "@/schemas/seasonMatch.schema";
import type { Venue } from "@/types/venue.types";

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
  | "notes";

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
];

function isSeasonMatchFormField(field: string): field is SeasonMatchFormField {
  return (FORM_FIELD_NAMES as readonly string[]).includes(field);
}

function getDefaultValues(match?: SeasonMatch | null): SeasonMatchFormInput {
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
  };
}

const EMPTY_FORM_VALUES = getDefaultValues(null);

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
  const defaultValues = useMemo(() => getDefaultValues(match), [match]);
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
        ...(match ? {} : { status: "scheduled" as const }),
        notes: values.notes,
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
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Match number" required error={errors.matchNumber?.message}>
          <Input
            {...register("matchNumber")}
            type="number"
            min={1}
            max={100}
            required
            placeholder="1"
            aria-invalid={Boolean(errors.matchNumber)}
          />
        </FormField>
        <FormField label="Round number" required error={errors.roundNumber?.message}>
          <Input
            {...register("roundNumber")}
            type="number"
            min={1}
            max={50}
            required
            aria-invalid={Boolean(errors.roundNumber)}
          />
        </FormField>
        <FormField label="Stage" required error={errors.stage?.message}>
          <Controller
            name="stage"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
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
        </FormField>
      </div>

      {stage === "group" ? (
        <FormField label="Group" required error={errors.groupRef?.message}>
          <Controller
            name="groupRef"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
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
        </FormField>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Kick-off" required error={errors.kickoffAt?.message}>
          <Input
            {...register("kickoffAt")}
            type="datetime-local"
            required
            readOnly={match?.status === "postponed"}
            aria-invalid={Boolean(errors.kickoffAt)}
          />
        </FormField>
        <FormField label="Venue / Ground" required error={errors.venueRef?.message}>
          <Controller
            name="venueRef"
            control={control}
            render={({ field }) => (
              <Select {...field} required aria-invalid={Boolean(errors.venueRef)}>
                <option value="">Choose a venue</option>
                {venues.filter((venue) => venue.status === "active" || venue._id === field.value).map((venue) => (
                  <option key={venue._id} value={venue._id}>
                    {venue.name}{venue.location ? " · " + venue.location : ""}
                  </option>
                ))}
              </Select>
            )}
          />
        </FormField>
      </div>

      {match?.status === "postponed" ? (
        <p className="-mt-2 text-xs text-muted">
          The original kick-off is preserved. Use Reschedule Match in the status manager to set a new date and time.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Home team" required error={errors.homeSeasonTeamRef?.message}>
          <Controller
            name="homeSeasonTeamRef"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
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
        </FormField>
        <FormField label="Away team" required error={errors.awaySeasonTeamRef?.message}>
          <Controller
            name="awaySeasonTeamRef"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
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
        </FormField>
      </div>

      <FormField label="Notes" error={errors.notes?.message}>
        <Textarea
          {...register("notes")}
          maxLength={1000}
          placeholder="Optional fixture notes"
          aria-invalid={Boolean(errors.notes)}
        />
      </FormField>

      {rootError ? <p className="text-sm text-danger" role="alert">{rootError}</p> : null}
      <p className="text-xs text-muted">
        {match
          ? "Editing fixture details does not change its recorded goals or current result."
          : "The fixture is created as scheduled. Record goals and update its status from its match page."}
      </p>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : match ? "Save changes" : "Save fixture"}
      </Button>
      
      {submitting ? (
        <LoadingSpinner
          label={match ? "Saving changes..." : "Creating fixture..."}
          size="lg"
          mode="cover"
          className="h-full w-full"
        />
      ) : null}
    </form>
  );
}
