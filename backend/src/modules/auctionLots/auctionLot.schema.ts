import {z} from "zod";
const objectId=z.string().regex(/^[a-f\d]{24}$/i,"Invalid ID");
const position=z.enum(["goalkeeper","defender","midfielder","forward"]);
export const nominatePlayerSchema=z.object({seasonId:objectId,playerId:objectId,playerPosition:position,isIconPlayer:z.boolean().default(false),isGoalkeeper:z.boolean().default(false)}).strict();
export const sellAuctionLotSchema=z.object({seasonTeamId:objectId,purchasePrice:z.coerce.number().finite().min(0),jerseyNo:z.coerce.number().int().min(1).max(99).nullable().optional()}).strict();
export const auctionLotStatusSchema=z.object({auctionStatus:z.enum(["unsold","withdrawn"])}).strict();
export const updateAuctionLotSchema=z.object({
 auctionStatus:z.enum(["pending","sold","unsold","withdrawn"]),
 seasonTeamId:objectId.nullable().optional(),
 purchasePrice:z.coerce.number().finite().min(0).nullable().optional(),
 jerseyNo:z.coerce.number().int().min(1).max(99).nullable().optional(),
 playerPosition:position.optional(),
 isIconPlayer:z.boolean().optional(),
 isGoalkeeper:z.boolean().optional()
}).strict().superRefine((value,context)=>{
 if(value.auctionStatus==="sold"&&(!value.seasonTeamId||value.purchasePrice===null||value.purchasePrice===undefined)){
  context.addIssue({code:"custom",path:["seasonTeamId"],message:"A sold lot requires a season team and purchase price"});
 }
});
export const auctionQuerySchema=z.object({seasonId:objectId,seasonTeamId:objectId.optional(),playerName:z.string().trim().min(1).max(80).optional(),playerPosition:position.optional(),auctionStatus:z.enum(["pending","sold","unsold","withdrawn"]).optional(),isIconPlayer:z.enum(["true","false"]).transform(v=>v==="true").optional(),isGoalkeeper:z.enum(["true","false"]).transform(v=>v==="true").optional()}).strict();
