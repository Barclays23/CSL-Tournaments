import { z } from "zod";
import {
  assetSchema,
  nameBase,
  objectIdSchema,
  optionalDate,
  optionalEmail,
  optionalMobile,
} from "../../shared/schemas/common.schema.js";

const playerBaseSchema = z.object({
  name: nameBase,
  mobile: optionalMobile,
  email: optionalEmail,
  dateOfBirth: optionalDate,
  profilePic: assetSchema.nullable().optional(),
  status: z.enum(["active", "inactive"]),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const playerCreateSchema = playerBaseSchema.extend({
  mobile: optionalMobile.default(null),
  email: optionalEmail.default(null),
  dateOfBirth: optionalDate.default(null),
  status: z.enum(["active", "inactive"]).default("active"),
}).strict();

export const playerUpdateSchema = playerBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one player field is required",
  });

const optionalStatus = z.union([z.enum(["active", "inactive"]), z.literal("")])
  .optional().transform((value) => value || undefined);

export const playerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(40).optional(),
  status: optionalStatus,
}).strict();

export { objectIdSchema };
