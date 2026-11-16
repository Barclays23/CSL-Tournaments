import { z } from "zod";

const objectId = z.string().regex(/^[a-f\\d]{24}$/i, "Invalid ObjectId");
const awardType = z.enum(["champions", "runner_up", "golden_boot", "golden_glove", "player_of_the_season", "best_young_player", "best_defender", "best_midfielder", "special"]);
const recipient = z.object({
  seasonTeamId: objectId,
  playerId: objectId.nullable().optional(),
}).strict();

function validateRecipients(type: string | undefined, recipients: Array<{ playerId?: string | null }> | undefined, context: z.RefinementCtx): void {
  if (!type || !recipients) return;
  if ((type === "champions" || type === "runner_up") && (recipients.length !== 1 || recipients[0]?.playerId)) {
    context.addIssue({ code: "custom", path: ["recipients"], message: "Champions and Runner-up require exactly one SeasonTeam recipient" });
  }
  if (["golden_boot", "golden_glove", "player_of_the_season", "best_young_player", "best_defender", "best_midfielder"].includes(type)
    && recipients.some((item) => !item.playerId)) {
    context.addIssue({ code: "custom", path: ["recipients"], message: "This individual award requires a Player and their SeasonTeam for every recipient" });
  }
  const keys = recipients.map((item) => item.playerId ? item.seasonTeamId + ":" + item.playerId : item.seasonTeamId + ":team");
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: "custom", path: ["recipients"], message: "Duplicate award recipients are not allowed" });
  }
}

export const seasonAwardCreateSchema = z.object({
  awardType,
  title: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  recipients: z.array(recipient).min(1).max(20),
}).strict().superRefine((value, context) => validateRecipients(value.awardType, value.recipients, context));

export const seasonAwardUpdateSchema = z.object({
  awardType: awardType.optional(),
  title: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  recipients: z.array(recipient).min(1).max(20).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one award field is required")
  .superRefine((value, context) => validateRecipients(value.awardType, value.recipients, context));
