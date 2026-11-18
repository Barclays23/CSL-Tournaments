import { z } from "zod";
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Choose a valid record");
export const seasonMatchFormSchema = z.object({
  matchNumber: z.coerce.number().int("Enter a whole match number").min(1, "Match number must be at least 1").max(9999, "Match number cannot exceed 9999"),
  roundNumber: z.coerce.number().int("Enter a whole round number").min(1, "Round number must be at least 1").max(999, "Round number cannot exceed 999"),
  stage: z.enum(["group", "round_of_16", "quarter_final", "semi_final", "third_place", "final"], { error: "Choose a fixture stage" }),
  groupRef: z.union([objectId, z.literal("")]).transform(value => value || null),
  kickoffAt: z.string().min(1, "Kick-off date and time is required").refine(value => !Number.isNaN(new Date(value).getTime()), "Enter a valid kick-off date and time"),
  venueRef: objectId,
  homeSeasonTeamRef: objectId,
  awaySeasonTeamRef: objectId,
  notes: z.string().trim().max(1000, "Notes must be 1000 characters or fewer").transform(value => value || null),
}).superRefine((value, context) => {
  if (value.homeSeasonTeamRef === value.awaySeasonTeamRef) context.addIssue({ code: "custom", path: ["awaySeasonTeamRef"], message: "Home and away teams must be different" });
  if (value.stage === "group" && !value.groupRef) context.addIssue({ code: "custom", path: ["groupRef"], message: "Choose a group for a group-stage fixture" });
  if (value.stage !== "group" && value.groupRef) context.addIssue({ code: "custom", path: ["groupRef"], message: "Knockout fixtures cannot belong to a group" });
});
export type SeasonMatchFormInput = z.input<typeof seasonMatchFormSchema>;
export type SeasonMatchFormValues = z.output<typeof seasonMatchFormSchema>;

export const goalFormSchema = z.object({
  scoringTeamRef: objectId,
  goalType: z.enum(["normal", "own_goal"]),
  scorerRef: z.string(),
  ownGoalPlayerRef: z.string(),
}).superRefine((value, context) => {
  if (value.goalType === "own_goal" && !value.ownGoalPlayerRef) {
    context.addIssue({ code: "custom", path: ["ownGoalPlayerRef"], message: "Choose the player who scored the own goal" });
  }
});
export type GoalFormValues = z.infer<typeof goalFormSchema>;
