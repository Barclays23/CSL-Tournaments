import {z} from "zod";
export const groupCreateSchema=z.object({groupName:z.string().trim().min(1).max(40),displayOrder:z.coerce.number().int().min(0).max(1000).default(0)}).strict();
export const groupUpdateSchema=z.object({groupName:z.string().trim().min(1).max(40).optional(),displayOrder:z.coerce.number().int().min(0).max(1000).optional()}).strict().refine(v=>Object.keys(v).length>0,"At least one group field is required");
