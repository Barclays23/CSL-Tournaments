import { z } from "zod";

export const uploadPurposeSchema = z.enum([
  "user-profile",
  "organizer-profile",
  "player-profile",
  "team-logo",
  "team-poster",
  "manager-profile",
  "sponsor-logo",
  "news-cover",
]);

export const imageUploadSchema = z.object({
  purpose: uploadPurposeSchema,
}).strict();
