import { Schema, model } from "mongoose";
import type { SeasonMatchFields, SeasonGoalFields } from "./seasonMatch.types.js";

const goalSchema = new Schema<SeasonGoalFields>({
  scoringSeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", required: true },
  scorerPlayerRef: { type: Schema.Types.ObjectId, ref: "Player", default: null },
  playerSeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", default: null },
  goalType: { type: String, enum: ["normal", "own_goal"], required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

const kickSchema = new Schema({
  seasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", required: true },
  playerRef: { type: Schema.Types.ObjectId, ref: "Player", default: null },
  result: { type: String, enum: ["scored", "missed", "saved"], required: true },
}, { _id: false });

const shootoutSchema = new Schema({
  status: { type: String, enum: ["pending", "completed"], required: true },
  homeTeamScore: { type: Number, min: 0, required: true },
  awayTeamScore: { type: Number, min: 0, required: true },
  kicks: { type: [kickSchema], default: [] },
}, { _id: false });

const statusHistorySchema = new Schema({
  fromStatus: { type: String, enum: ["scheduled", "live", "completed", "postponed", "cancelled", "abandoned"], required: true },
  toStatus: { type: String, enum: ["scheduled", "live", "completed", "postponed", "cancelled", "abandoned"], required: true },
  reason: { type: String, default: null, trim: true, maxlength: 500 },
  changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  changedAt: { type: Date, required: true },
  fromKickoffAt: { type: Date, default: null },
  toKickoffAt: { type: Date, default: null },
}, { _id: false, timestamps: false });

const correctionResultSchema = new Schema({
  homeScore: { type: Number, min: 0, required: true },
  awayScore: { type: Number, min: 0, required: true },
  goals: { type: [goalSchema], default: [] },
  penaltyShootout: { type: shootoutSchema, default: null },
  winnerSeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", default: null },
}, { _id: false, timestamps: false });
const correctionHistorySchema = new Schema({
  reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 1000 },
  correctedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  correctedAt: { type: Date, required: true },
  originalResult: { type: correctionResultSchema, required: true },
  correctedResult: { type: correctionResultSchema, required: true },
}, { _id: false, timestamps: false });
const resolutionSchema = new Schema({
  status: { type: String, enum: ["cancelled", "abandoned"], required: true },
  reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
  decidedAt: { type: Date, required: true },
}, { _id: false, timestamps: false });

const schema = new Schema<SeasonMatchFields>({
  seasonRef: { type: Schema.Types.ObjectId, ref: "Season", required: true, immutable: true },
  matchNumber: { type: Number, required: true, min: 1 },
  roundNumber: { type: Number, required: true, min: 1, max: 999 },
  stage: { type: String, enum: ["group", "round_of_16", "quarter_final", "semi_final", "third_place", "final"], required: true },
  groupRef: { type: Schema.Types.ObjectId, ref: "Group", default: null },
  kickoffAt: { type: Date, required: true },
  venueRef: { type: Schema.Types.ObjectId, ref: "Venue", required: true },
  homeSeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", required: true },
  awaySeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", required: true },
  status: { type: String, enum: ["scheduled", "live", "completed", "postponed", "cancelled", "abandoned"], default: "scheduled" },
  goals: { type: [goalSchema], default: [] },
  penaltyShootout: { type: shootoutSchema, default: null },
  winnerSeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", default: null },
  notes: { type: String, default: null, trim: true },
  resolutionHistory: { type: [resolutionSchema], default: [] },
  statusHistory: { type: [statusHistorySchema], default: [] },
  correctionHistory: { type: [correctionHistorySchema], default: [] },
}, { timestamps: true, versionKey: false });

schema.index({ seasonRef:  1, matchNumber: 1 }, { unique: true });
schema.index({ seasonRef: 1, kickoffAt: 1 });
schema.index({ seasonRef: 1, stage: 1, groupRef: 1, roundNumber: 1 });
schema.index({ seasonRef: 1, stage: 1, groupRef: 1, homeSeasonTeamRef: 1, awaySeasonTeamRef: 1 });
schema.index({ seasonRef: 1, stage: 1, groupRef: 1, status: 1 });
schema.index({ seasonRef: 1, homeSeasonTeamRef: 1, kickoffAt: -1 });
schema.index({ seasonRef: 1, awaySeasonTeamRef: 1, kickoffAt: -1 });

export const SeasonMatchModel = model<SeasonMatchFields>("SeasonMatch", schema);
