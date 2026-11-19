import { Schema, model } from "mongoose";
import type { SeasonFields } from "./season.types.js";

const auctionSettingsSchema = new Schema({
  currency: { type: String, enum: ["INR"], default: "INR", required: true },
  budgetPerTeam: { type: Number, required: true, min: 0 },
  playersCount: { type: Number, required: true, min: 1 },
  seasonTeamCount: { type: Number, required: true, min: 2 },
  teamSquadSize: { type: Number, required: true, min: 1 },
  iconPlayerLimit: { type: Number, required: true, min: 0 },
  goalkeeperLimit: { type: Number, required: true, min: 0 },
}, { _id: false });

const pointsRulesSchema = new Schema({
  win: { type: Number, required: true, min: 0 },
  draw: { type: Number, required: true, min: 0 },
  loss: { type: Number, required: true, min: 0 },
}, { _id: false });

const matchRulesSchema = new Schema({
  groupStageDrawAllowed: { type: Boolean, default: true, required: true },
  knockoutDrawRequiresShootout: { type: Boolean, default: true, required: true },
  shootoutCountsForMatchScore: { type: Boolean, default: false, immutable: true },
  shootoutCountsForPlayerGoals: { type: Boolean, default: false, immutable: true },
}, { _id: false });

const seasonSchema = new Schema<SeasonFields>({
  seasonNumber: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "Season number must be a positive integer" } },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  normalizedName: { type: String, required: true, select: false },
  year: { type: Number, required: true, min: 2000, max: 2200, validate: { validator: Number.isInteger, message: "Season year must be an integer" } },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  timeZone: { type: String, enum: ["Asia/Kolkata"], default: "Asia/Kolkata", required: true },
  groupStageEnabled: { type: Boolean, default: true, required: true },
  homeAndAwayFixtures: { type: Boolean, default: false, required: true },
  status: { type: String, enum: ["draft", "upcoming", "active", "completed", "archived"], default: "draft", required: true },
  historyCompleteness: { type: String, enum: ["not_applicable", "metadata_only", "partial", "full"], default: "not_applicable", required: true },
  auctionSettings: { type: auctionSettingsSchema, default: null },
  auctionLifecycleStatus: { type: String, enum: ["not_started", "in_progress", "completed"], default: "not_started", required: true },
  pointsRules: { type: pointsRulesSchema, default: null },
  standingsTieBreakers: { type: [{ type: String, enum: ["points", "goalDifference", "goalsScored", "teamNameAsc"] }], default: null },
  matchRules: { type: matchRulesSchema, default: null },
  auctionRevision: { type: Number, default: 0, select: false },
}, { timestamps: true, versionKey: false });

seasonSchema.index({ seasonNumber: 1 }, { unique: true });
seasonSchema.index({ normalizedName: 1 }, {
  unique: true,
  partialFilterExpression: { normalizedName: { $type: "string" } },
});
seasonSchema.index({ status: 1 }, {
  unique: true,
  partialFilterExpression: { status: "active" },
});
seasonSchema.index({ year: 1, status: 1 });

export const SeasonModel = model<SeasonFields>("Season", seasonSchema);
