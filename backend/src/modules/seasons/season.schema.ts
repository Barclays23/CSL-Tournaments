import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid team ID");

const auctionSettings = z.object({
  currency: z.literal("INR").default("INR"),
  budgetPerTeam: z.coerce.number().finite().min(0).max(100000000),
  playersCount: z.coerce.number().int().min(1).max(500),
  seasonTeamCount: z.coerce.number().int().min(1).max(64),
  teamSquadSize: z.coerce.number().int().min(1).max(40),
  iconPlayerLimit: z.coerce.number().int().min(0).max(40),
  goalkeeperLimit: z.coerce.number().int().min(0).max(40),
}).strict().superRefine((value, context) => {
  if (value.iconPlayerLimit > value.teamSquadSize) context.addIssue({ code: "custom", path: ["iconPlayerLimit"], message: "Icon limit cannot exceed squad size" });
  if (value.goalkeeperLimit > value.teamSquadSize) context.addIssue({ code: "custom", path: ["goalkeeperLimit"], message: "Goalkeeper limit cannot exceed squad size" });
});

const tieBreakers = z.array(z.enum(["points", "goalDifference", "goalsScored", "teamNameAsc"])).min(1).max(4)
  .refine((values) => new Set(values).size === values.length, "Tiebreakers must not contain duplicates");

const seasonFields = {
  seasonNumber: z.coerce.number().int().min(1).max(999),
  name: z.string().trim().min(2).max(100),
  year: z.coerce.number().int().min(2000).max(2200),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  timeZone: z.literal("Asia/Kolkata").default("Asia/Kolkata"),
  status: z.enum(["draft", "upcoming", "active", "completed", "archived"]).default("draft"),
  auctionSettings,
  pointsRules: z.object({
    win: z.coerce.number().finite().min(0),
    draw: z.coerce.number().finite().min(0),
    loss: z.coerce.number().finite().min(0),
  }).strict().default({ win: 3, draw: 1, loss: 0 }),
  standingsTieBreakers: tieBreakers.default(["points", "goalDifference", "goalsScored", "teamNameAsc"]),
  matchRules: z.object({
    groupStageDrawAllowed: z.boolean().default(true),
    knockoutDrawRequiresShootout: z.boolean().default(true),
    shootoutCountsForMatchScore: z.literal(false).default(false),
    shootoutCountsForPlayerGoals: z.literal(false).default(false),
  }).strict().default({ groupStageDrawAllowed: true, knockoutDrawRequiresShootout: true, shootoutCountsForMatchScore: false, shootoutCountsForPlayerGoals: false }),
};

const dateRules = (value: { startDate?: Date | null; endDate?: Date | null }, context: z.RefinementCtx) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date" });
  }
};

export const seasonCreateSchema = z.object({
  ...seasonFields,
  teamIds: z.array(objectId).max(64).default([]),
}).strict().superRefine((value, context) => {
  dateRules(value, context);
  if (new Set(value.teamIds).size !== value.teamIds.length) context.addIssue({ code: "custom", path: ["teamIds"], message: "A team can only be selected once" });
});

export const seasonUpdateSchema = z.object({
  seasonNumber: seasonFields.seasonNumber.optional(),
  name: seasonFields.name.optional(),
  year: seasonFields.year.optional(),
  startDate: seasonFields.startDate,
  endDate: seasonFields.endDate,
  timeZone: seasonFields.timeZone.optional(),
  status: seasonFields.status.optional(),
  auctionSettings: auctionSettings.optional(),
  pointsRules: seasonFields.pointsRules.optional(),
  standingsTieBreakers: tieBreakers.optional(),
  matchRules: seasonFields.matchRules.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one season field is required").superRefine(dateRules);

export const seasonQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  status: z.enum(["draft", "upcoming", "active", "completed", "archived"]).optional(),
}).strict();

export const registerSeasonTeamsSchema = z.object({
  teamIds: z.array(objectId).min(1).max(64),
}).strict().superRefine((value, context) => {
  if (new Set(value.teamIds).size !== value.teamIds.length) context.addIssue({ code: "custom", path: ["teamIds"], message: "A team can only be selected once" });
});
