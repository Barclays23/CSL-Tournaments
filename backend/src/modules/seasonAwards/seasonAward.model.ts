import { Schema, model } from "mongoose";
import type { SeasonAwardFields, SeasonAwardRecipientFields } from "./seasonAward.types.js";

const assetSchema = new Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
}, { _id: false });

const recipientSchema = new Schema<SeasonAwardRecipientFields>({
  recipientType: { type: String, enum: ["season_team", "player"], required: true },
  seasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", required: true },
  playerRef: { type: Schema.Types.ObjectId, ref: "Player", default: null },
  displayNameSnapshot: { type: String, required: true, trim: true },
  profileImageSnapshot: { type: assetSchema, default: null },
  teamNameSnapshot: { type: String, required: true, trim: true },
  teamLogoSnapshot: { type: assetSchema, default: null },
}, { _id: true });

const seasonAwardSchema = new Schema<SeasonAwardFields>({
  seasonRef: { type: Schema.Types.ObjectId, ref: "Season", required: true, immutable: true },
  awardType: {
    type: String,
    enum: ["champions", "runner_up", "golden_boot", "golden_glove", "player_of_the_season", "best_young_player", "best_defender", "best_midfielder", "special"],
    required: true,
  },
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  description: { type: String, default: null, trim: true, maxlength: 1000 },
  recipients: {
    type: [recipientSchema],
    required: true,
    validate: { validator: (value: unknown[]) => Array.isArray(value) && value.length >= 1 && value.length <= 20, message: "An award must have between one and twenty recipients" },
  },
}, { timestamps: true, versionKey: false });

seasonAwardSchema.index({ seasonRef: 1, awardType: 1 }, { unique: true });
seasonAwardSchema.index({ seasonRef: 1, "recipients.seasonTeamRef": 1 });
seasonAwardSchema.index({ seasonRef: 1, "recipients.playerRef": 1 });

export const SeasonAwardModel = model<SeasonAwardFields>("SeasonAward", seasonAwardSchema);
