import { Schema, model } from "mongoose";
import type { SeasonTeamFields } from "./seasonTeam.types.js";

const assetSchema = new Schema({ url: { type: String, required: true }, publicId: { type: String, required: true } }, { _id: false });
const seasonTeamSchema = new Schema<SeasonTeamFields>({
  seasonRef: { type: Schema.Types.ObjectId, ref: "Season", required: true, immutable: true },
  teamRef: { type: Schema.Types.ObjectId, ref: "Team", required: true, immutable: true },
  displayName: { type: String, required: true, trim: true },
  logoSnapshot: { type: assetSchema, default: null },
  groupRef: { type: Schema.Types.ObjectId, ref: "Group", default: null },
  managerRefs: [{ type: Schema.Types.ObjectId, ref: "Manager" }],
  status: { type: String, enum: ["registered", "active", "withdrawn", "eliminated", "completed"], default: "registered" },
}, { timestamps: true, versionKey: false });
seasonTeamSchema.index({ seasonRef: 1, teamRef: 1 }, { unique: true });
seasonTeamSchema.index({ seasonRef: 1, status: 1 });
export const SeasonTeamModel = model<SeasonTeamFields>("SeasonTeam", seasonTeamSchema);
