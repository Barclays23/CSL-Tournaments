import { z } from "zod";
export const venueFormSchema = z.object({
  name: z.string().trim().min(2, "Venue name must contain at least 2 characters").max(100, "Venue name must be 100 characters or fewer"),
  location: z.string().trim().max(160, "Location must be 160 characters or fewer"),
  notes: z.string().trim().max(500, "Notes must be 500 characters or fewer"),
});
export type VenueFormValues = z.infer<typeof venueFormSchema>;

export const venueUpdateFormSchema = venueFormSchema.partial().extend({
  status: z.enum(["active", "inactive"]).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one venue field is required");
