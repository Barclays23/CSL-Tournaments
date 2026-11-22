import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const assetSchema = z.object({ url: z.url(), publicId: z.string().trim().min(1) }).strict().nullable();
const fields = {
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().max(160).optional().refine((value) => !value || slugPattern.test(value), "Use lowercase letters, numbers and hyphens for the slug"),
  excerpt: z.string().trim().min(10).max(500),
  content: z.string().trim().min(10).max(100000),
  coverImage: assetSchema.optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(15).optional(),
  status: z.enum(["draft", "published", "archived"]),
  publishedAt: z.coerce.date().nullable().optional(),
};

export const newsCreateSchema = z.object({
  ...fields,
  status: fields.status.default("draft"),
}).strict();

export const newsUpdateSchema = z.object({
  title: fields.title.optional(),
  slug: fields.slug,
  excerpt: fields.excerpt.optional(),
  content: fields.content.optional(),
  coverImage: fields.coverImage,
  tags: fields.tags,
  status: fields.status.optional(),
  publishedAt: fields.publishedAt,
}).strict().refine((value) => Object.keys(value).length > 0, "At least one news field is required");

export const newsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  search: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
}).strict();
