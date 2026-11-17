import { z } from "zod";
import { nameBase, optionalDate, optionalEmail, optionalMobile } from "@/schemas/common.schema";

export const playerFormSchema = z.object({
  name: nameBase,
  mobile: optionalMobile,
  email: optionalEmail,
  dateOfBirth: optionalDate,
  status: z.enum(["active", "inactive"]),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type PlayerFormValues = z.infer<typeof playerFormSchema>;
