import { z } from "zod";

export const organizerFormSchema = z.object({
  name: z.string().trim().min(2).max(80),
  title: z.string().trim().min(2).max(80),
  mobile: z.string().trim().max(20).transform((value) => value || null),
  email: z.union([z.email().trim().toLowerCase(), z.literal("")]).transform((value) => value || null),
  displayOrder: z.coerce.number().int().min(0).max(10000),
  status: z.enum(["active", "inactive"]),
  notes: z.string().trim().max(1000).transform((value) => value || null),
});
export type OrganizerFormValues = z.infer<typeof organizerFormSchema>;
