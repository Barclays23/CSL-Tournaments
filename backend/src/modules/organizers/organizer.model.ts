import { Schema, model } from "mongoose";
import type { Asset } from "../../shared/types/common.types.js";
import type { OrganizerFields } from "./organizer.types.js";

const assetSchema = new Schema<Asset>({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
}, { _id: false });

const organizerSchema = new Schema<OrganizerFields>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  title: { type: String, required: true, trim: true, maxlength: 80 },
  mobile: { type: String, default: null, trim: true },
  email: { type: String, default: null, lowercase: true, trim: true },
  profilePic: { type: assetSchema, default: null },
  displayOrder: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
  notes: { type: String, default: null, trim: true, maxlength: 1000 },
}, { timestamps: true, versionKey: false });

organizerSchema.index({ status: 1, displayOrder: 1, name: 1 });
organizerSchema.index({ name: 1, title: 1 });
export const OrganizerModel = model<OrganizerFields>("Organizer", organizerSchema);
