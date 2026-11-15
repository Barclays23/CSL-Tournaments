import { z } from "zod";

const assetSchema = z.object({ url: z.url(), publicId: z.string().min(1) }).strict().nullable();
const mobileSchema = z.string().trim().min(7).max(20)
  .regex(/^\+?[0-9()\s-]+$/, "Enter a valid mobile number")
  .transform((value) => value.replace(/[()\s-]/g, "")).nullable().optional();
const emailSchema = z.email().trim().toLowerCase().nullable().optional();

const fields = {
  name: z.string().trim().min(2).max(80),
  title: z.string().trim().min(2).max(80),
  mobile: mobileSchema,
  email: emailSchema,
  profilePic: assetSchema.optional(),
  displayOrder: z.coerce.number().int().min(0).max(10000).optional(),
  status: z.union([z.enum(["active", "inactive"]), z.literal("")]).optional().transform((value) => value || undefined),
  notes: z.string().trim().max(1000).nullable().optional(),
};

export const organizerCreateSchema = z.object({
  ...fields,
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
  status: z.enum(["active", "inactive"]).default("active"),
}).strict();

export const organizerUpdateSchema = z.object({
  name: fields.name.optional(),
  title: fields.title.optional(),
  mobile: mobileSchema,
  email: emailSchema,
  profilePic: assetSchema.optional(),
  displayOrder: fields.displayOrder,
  status: fields.status,
  notes: fields.notes,
}).strict().refine((value) => Object.keys(value).length > 0, "At least one organizer field is required");

export const organizerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(80).optional(),
  title: z.string().trim().max(80).optional(),
  status: z.union([z.enum(["active", "inactive"]), z.literal("")]).optional().transform((value) => value || undefined),
}).strict();
