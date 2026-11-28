import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid team ID");

const auctionSettingsBase = z.object({
  currency: z.literal("INR").default("INR"),
  budgetPerTeam: z.coerce.number().finite().min(0).max(100000000),
  playersCount: z.coerce.number().int().min(1).max(500),
  seasonTeamCount: z.coerce.number().int().min(2).max(64),
  teamSquadSize: z.coerce.number().int().min(1).max(40),
  iconPlayerLimit: z.coerce.number().int().min(0).max(40),
  goalkeeperLimit: z.coerce.number().int().min(0).max(40),
}).strict();

const auctionSettings = auctionSettingsBase.superRefine((value, context) => {
  if (value.iconPlayerLimit > value.teamSquadSize) context.addIssue({ code: "custom", path: ["iconPlayerLimit"], message: "Icon limit cannot exceed squad size" });
  if (value.goalkeeperLimit > value.teamSquadSize) context.addIssue({ code: "custom", path: ["goalkeeperLimit"], message: "Goalkeeper limit cannot exceed squad size" });
});

const pointsRules = z.object({
  win: z.coerce.number().finite().min(0),
  draw: z.coerce.number().finite().min(0),
  loss: z.coerce.number().finite().min(0),
}).strict();

const regularMatchDuration = z.coerce.number().int().min(10).max(120).refine((value) => value % 2 === 0, "Regular match duration must be an even number from 10 to 120 minutes");
const extraTimeDuration = z.coerce.number().int().positive().refine((value) => value % 2 === 0, "Extra Time duration must be a positive even number of minutes");
const extraTimeDefaults = z.object({ isAllowedByDefault: z.boolean(), defaultDurationMinutes: extraTimeDuration }).strict();
const penaltyShootoutDefaults = z.object({ isAllowedByDefault: z.boolean() }).strict();
const matchRules = z.object({
  defaultMatchDurationMinutes: regularMatchDuration,
  extraTime: extraTimeDefaults,
  penaltyShootout: penaltyShootoutDefaults,
  shootoutCountsForMatchScore: z.literal(false),
  shootoutCountsForPlayerGoals: z.literal(false),
}).strict();

const tieBreakers = z.array(z.enum(["points", "goalDifference", "goalsScored", "teamNameAsc"])).min(1).max(4)
  .refine((values) => new Set(values).size === values.length, "Tiebreakers must not contain duplicates");

const dateValue = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format")
  .refine((value) => {
    const date = new Date(value + "T00:00:00.000Z");
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid calendar date")
  .transform((value) => new Date(value + "T00:00:00.000Z"))
  .nullable()
  .optional();

const dateRules = (value: { startDate?: Date | null; endDate?: Date | null }, context: z.RefinementCtx) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date" });
  }
};

export const seasonCreateSchema = z.object({
  seasonNumber: z.coerce.number().int().min(1),
  name: z.string().trim().min(2).max(100),
  year: z.coerce.number().int().min(2000).max(2200),
  startDate: dateValue,
  endDate: dateValue,
  timeZone: z.literal("Asia/Kolkata").default("Asia/Kolkata"),
  groupStageEnabled: z.boolean().default(true),
  homeAndAwayFixtures: z.boolean().default(false),
  auctionSettings,
  pointsRules: pointsRules.default({ win: 3, draw: 1, loss: 0 }),
  standingsTieBreakers: tieBreakers.default(["points", "goalDifference", "goalsScored", "teamNameAsc"]),
  matchRules: matchRules.default({
    defaultMatchDurationMinutes:30,
    extraTime: { isAllowedByDefault: false, defaultDurationMinutes: 10 },
    penaltyShootout: { isAllowedByDefault: true },
    shootoutCountsForMatchScore: false,
    shootoutCountsForPlayerGoals: false,
  }),
}).strict().superRefine((value, context) => {
  dateRules(value, context);
});

export const seasonUpdateSchema = z.object({
  seasonNumber: z.coerce.number().int().min(1).optional(),
  name: z.string().trim().min(2).max(100).optional(),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  startDate: dateValue,
  endDate: dateValue,
  timeZone: z.literal("Asia/Kolkata").optional(),
  groupStageEnabled: z.boolean().optional(),
  homeAndAwayFixtures: z.boolean().optional(),
  auctionSettings: auctionSettingsBase.partial().optional(),
  pointsRules: pointsRules.partial().optional(),
  standingsTieBreakers: tieBreakers.optional(),
  matchRules: z.object({
    groupStageDrawAllowed: z.boolean().optional(),
    defaultMatchDurationMinutes: regularMatchDuration.optional(),
    extraTime: z.object({ isAllowedByDefault: z.boolean().optional(), defaultDurationMinutes: extraTimeDuration.optional() }).strict().optional(),
    penaltyShootout: z.object({ isAllowedByDefault: z.boolean().optional() }).strict().optional(),
    shootoutCountsForMatchScore: z.literal(false).optional(),
    shootoutCountsForPlayerGoals: z.literal(false).optional(),
  }).strict().optional(),
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

export const seasonLifecycleSchema = z.object({
  status: z.enum(["draft", "upcoming", "active"]),
}).strict();
