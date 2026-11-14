import {z} from "zod";
const objectId=z.string().regex(/^[a-f\\d]{24}$/i,"Invalid ID");
export const nominatePlayerSchema=z.object({seasonId:objectId,playerId:objectId,playerPosition:z.enum(["goalkeeper","defender","midfielder","forward"]),isIconPlayer:z.boolean().default(false),isGoalkeeper:z.boolean().default(false)}).strict();
export const sellAuctionLotSchema=z.object({seasonTeamId:objectId,purchasePrice:z.coerce.number().finite().min(0),jerseyNo:z.coerce.number().int().min(1).max(99).nullable().optional()}).strict();
export const auctionLotStatusSchema=z.object({auctionStatus:z.enum(["unsold","withdrawn"])}).strict();
export const auctionQuerySchema=z.object({seasonId:objectId,seasonTeamId:objectId.optional(),playerPosition:z.enum(["goalkeeper","defender","midfielder","forward"]).optional(),auctionStatus:z.enum(["pending","sold","unsold","withdrawn"]).optional(),isIconPlayer:z.enum(["true","false"]).transform(v=>v==="true").optional(),isGoalkeeper:z.enum(["true","false"]).transform(v=>v==="true").optional()}).strict();
