import {z} from "zod";
const objectId=z.string().regex(/^[a-f\d]{24}$/i,"Invalid ID");
export const updateSeasonTeamSchema=z.object({
 managerIds:z.array(objectId).max(20).optional(),
 groupId:objectId.nullable().optional(),

}).strict().refine(v=>Object.keys(v).length>0,"At least one field is required")
.superRefine((v,c)=>{if(v.managerIds&&new Set(v.managerIds).size!==v.managerIds.length)c.addIssue({code:"custom",path:["managerIds"],message:"Managers must not be duplicated"});});

export const recallSeasonTeamSchema=z.object({reason:z.string().trim().min(3).max(500)}).strict();
