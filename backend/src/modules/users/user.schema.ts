import { z } from "zod";

const mobileSchema = z.string().trim().min(7).max(20)
  .regex(/^\+?[0-9()\s-]+$/, "Enter a valid mobile number")
  .transform((value) => value.replace(/[()\s-]/g, "")).nullable().optional();
const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/).nullable().optional();
const assetSchema = z.object({ url: z.url(), publicId: z.string().min(1) }).strict().nullable();

const userFields = {
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  mobile: mobileSchema,
  username: usernameSchema,
  profilePic: assetSchema.optional(),
};

export const userCreateSchema = z.object({
  ...userFields,
  password: z.string().min(10).max(128),
  role: z.enum(["user", "admin"]).default("user"),
  status: z.enum(["active", "blocked"]).default("active"),
}).strict();

export const userUpdateSchema = z.object({
  name: userFields.name.optional(),
  email: userFields.email.optional(),
  mobile: mobileSchema,
  username: usernameSchema,
  profilePic: assetSchema.optional(),
  password: z.string().min(10).max(128).optional(),
  role: z.union([z.enum(["user", "admin"]), z.literal("")]).optional().transform((value) => value || undefined),
  status: z.union([z.enum(["active", "blocked"]), z.literal("")]).optional().transform((value) => value || undefined),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one user field is required");

export const userStatusSchema = z.object({ status: z.enum(["active", "blocked"]) }).strict();

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(80).optional(),
  role: z.union([z.enum(["user", "admin"]), z.literal("")]).optional().transform((value) => value || undefined),
  status: z.union([z.enum(["active", "blocked"]), z.literal("")]).optional().transform((value) => value || undefined),
}).strict();
