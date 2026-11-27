import { z } from "zod";
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Choose a valid record");
export const seasonMatchFormSchema = z
  .object({
    matchNumber: z.coerce
      .number()
      .int("Enter a whole match number")
      .min(1, "Match number is required")
      .max(100, "Match number cannot exceed 100"),
    roundNumber: z.coerce
      .number()
      .int("Enter a whole round number")
      .min(1, "Round number is requied")
      .max(50, "Round number cannot exceed 50"),
    stage: z.enum(
      [
        "group",
        "round_of_16",
        "quarter_final",
        "semi_final",
        "third_place",
        "final",
      ],
      { error: "Choose a fixture stage" },
    ),
    groupRef: z
      .union([objectId, z.literal("")])
      .transform((value) => value || null),
    kickoffAt: z
      .string()
      .min(1, "Kick-off date and time is required")
      .refine(
        (value) => !Number.isNaN(new Date(value).getTime()),
        "Enter a valid kick-off date and time",
      ),
    venueRef: z
      .string()
      .min(1, "Choose a venue")
      .regex(/^[a-f\d]{24}$/i, "Choose a valid venue"),
    homeSeasonTeamRef: z
      .string()
      .min(1, "Choose the home team")
      .regex(/^[a-f\d]{24}$/i, "Choose a valid home team"),
    awaySeasonTeamRef: z
      .string()
      .min(1, "Choose the away team")
      .regex(/^[a-f\d]{24}$/i, "Choose a valid away team"),
    notes: z
      .string()
      .trim()
      .max(1000, "Notes must be 1000 characters or fewer")
      .transform((value) => value || null),
    matchDurationMinutes: z.coerce.number().int("Match duration must be a whole number").min(10, "Regular Match duration must be at least 10 minutes").max(120, "Regular Match duration cannot exceed 120 minutes").refine((value) => value % 2 === 0, "Regular Match duration must be even"),
    extraTimeIsAllowed: z.boolean(),
    extraTimeDurationMinutes: z.coerce.number().int("Extra Time duration must be a whole number").positive("Extra Time duration must be greater than zero").refine((value) => value % 2 === 0, "Extra Time duration must be even"),
    penaltyShootoutIsAllowed: z.boolean(),
  })
  .superRefine((value, context) => {
    if (
      value.homeSeasonTeamRef &&
      value.awaySeasonTeamRef &&
      value.homeSeasonTeamRef === value.awaySeasonTeamRef
    ) {
      context.addIssue({
        code: "custom",
        path: ["awaySeasonTeamRef"],
        message: "Home and away teams must be different",
      });
    }
    if (value.stage === "group" && !value.groupRef)
      context.addIssue({
        code: "custom",
        path: ["groupRef"],
        message: "Choose a group for a group-stage fixture",
      });
    if (value.stage !== "group" && value.groupRef)
      context.addIssue({
        code: "custom",
        path: ["groupRef"],
        message: "Knockout fixtures cannot belong to a group",
      });
  });
export type SeasonMatchFormInput = z.input<typeof seasonMatchFormSchema>;
export type SeasonMatchFormValues = z.output<typeof seasonMatchFormSchema>;
