import { Schema, model } from "mongoose";
import type { SeasonFields } from "./season.types.js";

const auctionSettingsSchema = new Schema({
  currency: { type: String, enum: ["INR"], default: "INR", required: true },
  budgetPerTeam: { type: Number, required: true, min: 0 },
  playersCount: { type: Number, required: true, min: 1 },
  seasonTeamCount: { type: Number, required: true, min: 1 },
  teamSquadSize: { type: Number, required: true, min: 1 },
  iconPlayerLimit: { type: Number, required: true, min: 0 },
  goalkeeperLimit: { type: Number, required: true, min: 0 },
}, { _id: false });

const pointsRulesSchema = new Schema({
  win: { type: Number, default: 3, min: 0 },
  draw: { type: Number, default: 1, min: 0 },
  loss: { type: Number, default: 0, min: 0 },
}, { _id: false });

const matchRulesSchema = new Schema({
  groupStageDrawAllowed: { type: Boolean, default: true },
  knockoutDrawRequiresShootout: { type: Boolean, default: true },
  shootoutCountsForMatchScore: { type: Boolean, default: false, immutable: true },
  shootoutCountsForPlayerGoals: { type: Boolean, default: false, immutable: true },
}, { _id: false });

const seasonSchema = new Schema<SeasonFields>({
  seasonNumber: { type: Number, required: true, unique: true, min: 1 },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  year: { type: Number, required: true, min: 2000, max: 2200 },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  timeZone: { type: String, enum: ["Asia/Kolkata"], default: "Asia/Kolkata", required: true },
  status: { type: String, enum: ["draft", "upcoming", "active", "completed", "archived"], default: "draft" },
  auctionSettings: { type: auctionSettingsSchema, required: true },
  pointsRules: { type: pointsRulesSchema, default: () => ({ win: 3, draw: 1, loss: 0 }) },
  standingsTieBreakers: { type: [{ type: String, enum: ["points", "goalDifference", "goalsScored", "teamNameAsc"] }], default: ["points", "goalDifference", "goalsScored", "teamNameAsc"] },
  matchRules: { type: matchRulesSchema, default: () => ({}) },
  auctionRevision: { type: Number, default: 0, select: false },
}, { timestamps: true, versionKey: false });

seasonSchema.index({ year: 1, status: 1 });
export const SeasonModel = model<SeasonFields>("Season", seasonSchema);
