import { Schema, model } from "mongoose";
import type { Asset } from "../../shared/types/common.types.js";
import type { NewsFields } from "./news.types.js";

const assetSchema = new Schema<Asset>({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
}, { _id: false });

const newsSchema = new Schema<NewsFields>({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
  excerpt: { type: String, required: true, trim: true, maxlength: 500 },
  content: { type: String, required: true, maxlength: 100000 },
  coverImage: { type: assetSchema, default: null },
  tags: { type: [String], default: [] },
  status: { type: String, enum: ["draft", "published", "archived"], default: "draft", index: true },
  publishedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

newsSchema.index({ slug: 1 }, { unique: true });
newsSchema.index({ status: 1, publishedAt: -1, createdAt: -1 });

export const NewsModel = model<NewsFields>("News", newsSchema);
