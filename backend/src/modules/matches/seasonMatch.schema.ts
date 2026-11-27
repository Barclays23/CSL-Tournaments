import { z } from "zod";
import { paginationSchema } from "../../shared/dto/pagination.dto.js";
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID");
const stage = z.enum([
  "group",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
]);
const status = z.enum(["scheduled","live","completed","postponed","cancelled","abandoned"]);
const regularDuration=z.coerce.number().int().min(10).max(120).refine(v=>v%2===0);
const extraDuration=z.coerce.number().int().positive().refine(v=>v%2===0);
const decidingRules=z.object({extraTime:z.object({isAllowed:z.boolean(),durationMinutes:extraDuration}).strict(),penaltyShootout:z.object({isAllowed:z.boolean()}).strict()}).strict();
const eventTiming=z.object({period:z.enum(["first_half","second_half","extra_time_first_half","extra_time_second_half"]).nullable().optional(),minute:z.number().int().positive().nullable().optional(),addedMinutes:z.number().int().nonnegative().optional()}).strict();
const kick = z
  .object({
    seasonTeamRef: objectId,
    playerRef: objectId.nullable().optional(),
    result: z.enum(["scored", "missed", "saved"]),
  })
  .strict();
const shootout = z
  .object({
    status: z.enum(["pending", "completed"]),
    homeTeamScore: z.coerce.number().int().min(0),
    awayTeamScore: z.coerce.number().int().min(0),
    kicks: z.array(kick).max(30),
  })
  .strict();
const fields = {
  matchNumber: z.coerce.number().int().min(1).max(100),
  roundNumber: z.coerce.number().int().min(1).max(50),
  stage,
  groupRef: objectId.nullable().optional(),
  kickoffAt: z.coerce.date(),
  venueRef: objectId,
  homeSeasonTeamRef: objectId,
  awaySeasonTeamRef: objectId,
  notes: z.string().trim().max(1000).nullable().optional(),
  matchDurationMinutes:regularDuration.optional(),
  decidingRules:decidingRules.optional(),
};
export const seasonMatchCreateSchema = z
  .object(fields)
  .strict()
  .superRefine((v, context) => {
    if (v.homeSeasonTeamRef === v.awaySeasonTeamRef)
      context.addIssue({
        code: "custom",
        path: ["awaySeasonTeamRef"],
        message: "Home and away teams must be different",
      });
    if (v.stage === "group" && !v.groupRef)
      context.addIssue({
        code: "custom",
        path: ["groupRef"],
        message: "Choose a group for a group-stage fixture",
      });
    if (v.stage !== "group" && v.groupRef)
      context.addIssue({
        code: "custom",
        path: ["groupRef"],
        message: "Knockout fixtures cannot belong to a group",
      });
    if (v.stage === "group" && (v.decidingRules?.extraTime.isAllowed || v.decidingRules?.penaltyShootout.isAllowed))
      context.addIssue({
        code: "custom",
        path: ["decidingRules"],
        message: "Group-stage fixtures must have Extra Time and Penalty Shootout disabled",
      });
  });
export const seasonMatchUpdateSchema = z
  .object({
    matchNumber: fields.matchNumber.optional(),
    roundNumber: fields.roundNumber.optional(),
    stage: fields.stage.optional(),
    groupRef: fields.groupRef.optional(),
    kickoffAt: fields.kickoffAt.optional(),
    venueRef: fields.venueRef.optional(),
    homeSeasonTeamRef: fields.homeSeasonTeamRef.optional(),
    awaySeasonTeamRef: fields.awaySeasonTeamRef.optional(),
    notes: fields.notes.optional(),
    matchDurationMinutes: fields.matchDurationMinutes.optional(),
  })
  .strict()
  .superRefine((v, context) => {
    if (Object.keys(v).length === 0) {
      context.addIssue({ code: "custom", message: "At least one fixture field is required" });
    }
    if (v.homeSeasonTeamRef && v.awaySeasonTeamRef && v.homeSeasonTeamRef === v.awaySeasonTeamRef) {
      context.addIssue({
        code: "custom",
        path: ["awaySeasonTeamRef"],
        message: "Home and away teams must be different",
      });
    }
    if (v.stage === "group" && v.groupRef === null) {
      context.addIssue({
        code: "custom",
        path: ["groupRef"],
        message: "Choose a group for a group-stage fixture",
      });
    }
    if (v.stage && v.stage !== "group" && v.groupRef) {
      context.addIssue({
        code: "custom",
        path: ["groupRef"],
        message: "Knockout fixtures cannot belong to a group",
      });
    }
  });

export const seasonMatchCorrectionSchema = z
  .object({
    reason: z.string().trim().min(3).max(1000),
    goals: z
      .array(
        z
          .object({
            scoringSeasonTeamRef: objectId,
            scorerPlayerRef: objectId.nullable().optional(),
            goalType:z.enum(["normal","own_goal"]),...eventTiming.shape,
          })
          .strict(),
      )
      .max(100),
    penaltyShootout: shootout.nullable(),
  })
  .strict();
export const seasonMatchRescheduleSchema = z
  .object({
    kickoffAt: z.coerce.date(),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const decidingRulesUpdateSchema = z.object({
  decidingRules,
  reason: z.string().trim().min(3).max(1000).optional(),
}).strict();

export const matchStatusActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("postpone"), reason: z.string().trim().min(3).max(500) }).strict(),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3).max(500) }).strict(),
  z.object({ action: z.literal("abandon"), reason: z.string().trim().min(3).max(500) }).strict(),
  z.object({ action: z.literal("resume") }).strict(),
]);

export const actualKickoffCorrectionSchema = z.object({
  actualStartedAt: z.coerce.date(),
  reason: z.string().trim().min(3).max(1000),
}).strict();

export const matchClockCorrectionSchema = z.object({
  periodElapsedSecondsByPeriod: z.object({
    firstHalf: z.number().int().nonnegative().optional(),
    secondHalf: z.number().int().nonnegative().optional(),
    extraTimeFirstHalf: z.number().int().nonnegative().optional(),
    extraTimeSecondHalf: z.number().int().nonnegative().optional(),
  }).strict().refine(v => Object.keys(v).length > 0, "Provide at least one period correction"),
  reason: z.string().trim().min(3).max(1000),
}).strict();

export const matchShootoutUpdateSchema = z.object({
  homeTeamScore: z.number().int().nonnegative(),
  awayTeamScore: z.number().int().nonnegative(),
  kicks: z.array(kick).max(30),
}).strict();

export const matchPhaseTransitionSchema = z.object({
  action: z.enum(["half_time", "start_second_half", "regular_full_time", "start_extra_time", "extra_time_half_time", "start_extra_time_second_half", "end_extra_time", "start_penalty_shootout", "complete_penalty_shootout"]),
}).strict();

export const matchPhaseCorrectionSchema = z.object({
  phase: z.enum(["first_half", "half_time", "second_half", "regular_full_time", "extra_time_first_half", "extra_time_half_time", "extra_time_second_half", "extra_time_completed", "penalty_shootout", "penalty_shootout_completed"]),
  reason: z.string().trim().min(3).max(1000),
}).strict();

export const seasonMatchQuerySchema = paginationSchema
  .extend({
    stage: stage.optional(),
    groupRef: objectId.nullable().optional(),
    status: status.optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    seasonTeamRef: objectId.optional(),
    search: z.string().trim().max(100).optional(),
  })
  .strict();
export const seasonGoalSchema = z
  .object({
    scoringSeasonTeamRef: objectId,
    scorerPlayerRef: objectId.nullable().optional(),
    goalType:z.enum(["normal","own_goal"]),...eventTiming.shape,
  })
  .strict();
export const seasonMatchCardSchema = z
  .object({
    seasonTeamRef: objectId,
    playerRef: objectId,
    cardType:z.enum(["yellow_card","red_card","second_yellow"]),...eventTiming.shape,
  })
  .strict();
