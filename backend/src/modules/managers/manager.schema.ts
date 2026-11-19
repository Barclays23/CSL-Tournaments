import { z } from "zod";
import {
  assetSchema,
  mobileBase,
  nameBase,
  optionalDate,
  optionalEmail,
} from "../../shared/schemas/common.schema.js";

const managerRoleSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .refine((value) => value.length <= 40, "Role cannot exceed 40 characters")
  .refine(
    (value) => /^(?:[A-Za-z]+(?:\s[A-Za-z]+)*)?$/.test(value),
    "Role can contain only letters and single spaces"
  )
  .transform((value) => value || null);

const managerBaseSchema = z.object({
  name: nameBase,
  mobile: mobileBase,
  email: optionalEmail,
  dateOfBirth: optionalDate,
  role: managerRoleSchema.optional(),
  profilePic: assetSchema.nullable().optional(),
  status: z.enum(["active", "inactive"], {
    error: "Select a valid manager status",
  }),
});

export const managerCreateSchema = managerBaseSchema
  .extend({
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .strict();

export const managerUpdateSchema = managerBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one manager field is required",
  });

export const managerQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(40).optional(),
    status: z
      .union([z.enum(["active", "inactive"]), z.literal("")])
      .optional()
      .transform((value) => value || undefined),
  })
  .strict();
