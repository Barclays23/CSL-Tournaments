import { z } from "zod";

export const newsFormSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().max(160),
  excerpt: z.string().trim().min(10).max(500),
  content: z.string().trim().min(10).max(100000),
  tags: z.string().max(500),
  status: z.enum(["draft", "published", "archived"]),
  publishedAt: z.string(),
});
export type NewsFormValues = z.infer<typeof newsFormSchema>;
