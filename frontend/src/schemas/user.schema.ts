import { z } from "zod";

export const userFormSchema = z.object({
  name: z.string().trim().min(2, "Name must contain at least 2 characters").max(80),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  mobile: z.string().trim().max(20).transform((value) => value || null),
  username: z.string().trim().toLowerCase().max(30).refine((value) => !value || /^[a-z0-9_]{3,30}$/.test(value), "Use 3–30 letters, numbers or underscores").transform((value) => value || null),
  password: z.string().max(128).optional(),
  role: z.enum(["user", "admin"]),
  status: z.enum(["active", "blocked"]),
});
export type UserFormValues = z.infer<typeof userFormSchema>;
