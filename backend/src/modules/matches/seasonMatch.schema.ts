import { z } from "zod";
import { paginationSchema } from "../../shared/dto/pagination.dto.js";
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID");
const stage = z.enum(["group", "round_of_16", "quarter_final", "semi_final", "third_place", "final"]);
const status = z.enum(["scheduled", "live", "completed", "postponed", "cancelled", "abandoned"]);
const kick = z.object({ seasonTeamRef: objectId, playerRef: objectId.nullable().optional(), result: z.enum(["scored", "missed", "saved"]) }).strict();
const shootout = z.object({ status: z.enum(["pending", "completed"]), homeTeamScore: z.coerce.number().int().min(0), awayTeamScore: z.coerce.number().int().min(0), kicks: z.array(kick).max(30) }).strict();
const fields = {
 matchNumber: z.coerce.number().int().min(1).max(9999), roundNumber: z.coerce.number().int().min(1).max(999), stage, groupRef: objectId.nullable().optional(),
 kickoffAt: z.coerce.date(), venueRef: objectId,
 homeSeasonTeamRef: objectId, awaySeasonTeamRef: objectId, status: status.optional(),
 notes: z.string().trim().max(1000).nullable().optional(), penaltyShootout: shootout.nullable().optional(),
};
export const seasonMatchCreateSchema = z.object(fields).strict().superRefine((v, context) => {
  if (v.homeSeasonTeamRef === v.awaySeasonTeamRef) context.addIssue({ code: "custom", path: ["awaySeasonTeamRef"], message: "Home and away teams must be different" });
  if (v.stage === "group" && !v.groupRef) context.addIssue({ code: "custom", path: ["groupRef"], message: "Choose a group for a group-stage fixture" });
  if (v.stage !== "group" && v.groupRef) context.addIssue({ code: "custom", path: ["groupRef"], message: "Knockout fixtures cannot belong to a group" });
 });
export const seasonMatchUpdateSchema = z.object({
 matchNumber: fields.matchNumber.optional(),
 roundNumber: fields.roundNumber.optional(),
 stage: fields.stage.optional(),
 groupRef: fields.groupRef.optional(),
 kickoffAt: fields.kickoffAt.optional(),
 venueRef: fields.venueRef.optional(),
 homeSeasonTeamRef: fields.homeSeasonTeamRef.optional(),
 awaySeasonTeamRef: fields.awaySeasonTeamRef.optional(),
 status: fields.status.optional(),
 notes: fields.notes.optional(),
 penaltyShootout: fields.penaltyShootout.optional(),
 resolutionReason: z.string().trim().min(3).max(500).optional(),
 statusReason: z.string().trim().min(3).max(500).optional(),
}).strict().superRefine((v, context) => {
  if (Object.keys(v).length === 0) context.addIssue({ code: "custom", message: "At least one field is required" });
  if (v.statusReason !== undefined && v.resolutionReason !== undefined && v.statusReason !== v.resolutionReason) context.addIssue({ code: "custom", path: ["statusReason"], message: "Use one consistent reason for the status change" });
  if (v.homeSeasonTeamRef && v.awaySeasonTeamRef && v.homeSeasonTeamRef === v.awaySeasonTeamRef) context.addIssue({ code: "custom", path: ["awaySeasonTeamRef"], message: "Home and away teams must be different" });
  if (v.stage === "group" && v.groupRef === null) context.addIssue({ code: "custom", path: ["groupRef"], message: "Choose a group for a group-stage fixture" });
  if (v.stage && v.stage !== "group" && v.groupRef) context.addIssue({ code: "custom", path: ["groupRef"], message: "Knockout fixtures cannot belong to a group" });
 });

export const seasonMatchCorrectionSchema = z.object({
 reason: z.string().trim().min(3).max(1000),
 goals: z.array(z.object({ scoringSeasonTeamRef: objectId, scorerPlayerRef: objectId.nullable().optional(), goalType: z.enum(["normal", "own_goal"]) }).strict()).max(100),
 penaltyShootout: shootout.nullable(),
}).strict();
export const seasonMatchRescheduleSchema = z.object({
 kickoffAt: z.coerce.date(),
 reason: z.string().trim().min(3).max(500).optional(),
}).strict();

export const seasonMatchQuerySchema = paginationSchema.extend({ stage: stage.optional(), groupRef: objectId.nullable().optional(), status: status.optional(), dateFrom: z.coerce.date().optional(), dateTo: z.coerce.date().optional(), seasonTeamRef: objectId.optional(), search: z.string().trim().max(100).optional() }).strict();
export const seasonGoalSchema = z.object({ scoringSeasonTeamRef: objectId, scorerPlayerRef: objectId.nullable().optional(), goalType: z.enum(["normal", "own_goal"]) }).strict();
export const seasonMatchCardSchema = z.object({ seasonTeamRef: objectId, playerRef: objectId, cardType: z.enum(["yellow_card", "red_card", "second_yellow"]) }).strict();
