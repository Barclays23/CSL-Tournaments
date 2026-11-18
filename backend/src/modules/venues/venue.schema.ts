import { z } from "zod";
const name = z.string().trim().min(2, "Venue name must contain at least 2 characters").max(100, "Venue name must be 100 characters or fewer");
const location = z.string().trim().max(160, "Location must be 160 characters or fewer").nullable().optional();
const notes = z.string().trim().max(500, "Notes must be 500 characters or fewer").nullable().optional();
export const venueCreateSchema = z.object({ name, location, notes }).strict();
export const venueUpdateSchema = z.object({ name: name.optional(), location, notes, status: z.enum(["active", "inactive"]).optional() }).strict().refine(value => Object.keys(value).length > 0, "At least one field is required");
export const venueQuerySchema = z.object({ status: z.enum(["active", "inactive", "all"]).optional() }).strict();
