import { Schema, model } from "mongoose";
import type { VenueFields } from "./venue.types.js";
const venueSchema = new Schema<VenueFields>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  normalizedName: { type: String, required: true, select: false },
  location: { type: String, default: null, trim: true, maxlength: 160 },
  notes: { type: String, default: null, trim: true, maxlength: 500 },
  status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
}, { timestamps: true, versionKey: false, collection: "venues" });
venueSchema.index({ normalizedName: 1 }, { unique: true });
venueSchema.index({ status: 1, name: 1 });
export const VenueModel = model<VenueFields>("Venue", venueSchema);
