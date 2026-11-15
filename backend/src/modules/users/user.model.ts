import { Schema, model } from "mongoose";
import type { Asset } from "../../shared/types/common.types.js";
import type { UserFields } from "./user.types.js";

const assetSchema = new Schema<Asset>({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
}, { _id: false });

const userSchema = new Schema<UserFields>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  mobile: { type: String, unique: true, sparse: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["user", "admin"], default: "user", required: true },
  profilePic: { type: assetSchema, default: null },
  status: { type: String, enum: ["active", "blocked"], default: "active", required: true },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

export type UserRecord = UserFields;
export const UserModel = model<UserFields>("User", userSchema);
