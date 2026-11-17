import { Schema, model } from "mongoose";
import type { Asset } from "../../shared/types/common.types.js";
import type { PlayerFields } from "./player.types.js";

const playerAssetSchema = new Schema<Asset>({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
}, { _id: false });

const playerSchema = new Schema<PlayerFields>({
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 40 },
  mobile: { type: String, default: null, trim: true },
  email: { type: String, default: null, lowercase: true, trim: true },
  dateOfBirth: { type: Date, default: null },
  profilePic: { type: playerAssetSchema, default: null },
  status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
  notes: { type: String, default: null, trim: true, maxlength: 2000 },
}, { timestamps: true, strict: "throw", autoIndex: false });

playerSchema.index({ name: 1 });
playerSchema.index({ status: 1, name: 1 });
playerSchema.index({ mobile: 1 }, {
  unique: true,
  partialFilterExpression: { mobile: { $type: "string", $gt: "" } },
});
playerSchema.index({ email: 1 }, {
  unique: true,
  partialFilterExpression: { email: { $type: "string", $gt: "" } },
});

export type PlayerRecord = PlayerFields;
export const PlayerModel = model<PlayerFields>("Player", playerSchema);
