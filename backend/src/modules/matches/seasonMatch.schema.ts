import { z } from "zod";
import { paginationSchema } from "../../shared/dto/pagination.dto.js";
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID");
const stage = z.enum(["group", "round_of_16", "quarter_final", "semi_final", "third_place", "final"]);
const status = z.enum(["scheduled", "live", "completed", "postponed", "cancelled", "abandoned"]);
const kick = z.object({ seasonTeamRef: objectId, playerRef: objectId.nullable().optional(), result: z.enum(["scored", "missed", "saved"]) }).strict();
const shootout = z.object({ status: z.enum(["pending", "completed"]), homeTeamScore: z.coerce.number().int().min(0), awayTeamScore: z.coerce.number().int().min(0), kicks: z.array(kick).max(30) }).strict();
const fields = {
 matchNumber: z.coerce.number().int().min(1).max(9999), stage, groupRef: objectId.nullable().optional(),
 kickoffAt: z.coerce.date(), venue: z.string().trim().max(160).nullable().optional(),
 homeSeasonTeamRef: objectId, awaySeasonTeamRef: objectId, status: status.optional(),
 notes: z.string().trim().max(1000).nullable().optional(), penaltyShootout: shootout.nullable().optional(),
};
export const seasonMatchCreateSchema = z.object(fields).strict().refine(v => v.homeSeasonTeamRef !== v.awaySeasonTeamRef, { path: ["awaySeasonTeamRef"], message: "A team cannot play itself" });
export const seasonMatchUpdateSchema = z.object({
 ...Object.fromEntries(Object.entries(fields).map(([k,v]) => [k,v.optional()])),
 resolutionReason: z.string().trim().min(3).max(500).optional(),
}).strict().refine(v => Object.keys(v).length > 0, "At least one field is required");
export const seasonMatchQuerySchema = paginationSchema.extend({ stage: stage.optional(), groupRef: objectId.nullable().optional(), status: status.optional(), dateFrom: z.coerce.date().optional(), dateTo: z.coerce.date().optional(), seasonTeamRef: objectId.optional(), search: z.string().trim().max(100).optional() }).strict();
export const seasonGoalSchema = z.object({ scoringSeasonTeamRef: objectId, scorerPlayerRef: objectId.nullable().optional(), goalType: z.enum(["normal", "own_goal"]) }).strict();
