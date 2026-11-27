import mongoose from "mongoose";
import { PlayerModel } from "../modules/players/player.model.js";
import { SeasonModel } from "../modules/seasons/season.model.js";
import { AuctionLotModel } from "../modules/auctionLots/auctionLot.model.js";

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  await ensureOptionalPlayerMobileIndex();
  await migrateAuctionLifecycleStatus();
  await migrateMatchTimingFields();
  console.log("MongoDB connected");
}
async function ensureOptionalPlayerMobileIndex(): Promise<void> {
  // Replace a legacy plain unique index: it incorrectly treats null/empty
  // values as duplicates. Only non-empty mobile strings should be unique.
  await PlayerModel.createCollection().catch((error: unknown) => {
    if ((error as { code?: number }).code !== 48) throw error;
  });

  const indexes = await PlayerModel.collection.indexes();
  const correctMobileIndex = indexes.find((index) => {
    const keys = Object.keys(index.key ?? {});
    const partial = index.partialFilterExpression as { mobile?: { $type?: string; $gt?: string } } | undefined;
    return keys.length === 1 && index.key.mobile === 1 && index.unique === true
      && partial?.mobile?.$type === "string" && partial.mobile.$gt === "";
  });

  for (const index of indexes) {
    const keys = Object.keys(index.key ?? {});
    if (keys.length === 1 && index.key.mobile === 1 && index.name !== correctMobileIndex?.name) {
      if (index.name) await PlayerModel.collection.dropIndex(index.name);
    }
  }

  await PlayerModel.collection.updateMany(
    { mobile: { $type: "string", $regex: "^\\s*$" } },
    { $set: { mobile: null } },
  );

  if (!correctMobileIndex) {
    await PlayerModel.collection.createIndex(
      { mobile: 1 },
      { name: "mobile_1", unique: true, partialFilterExpression: { mobile: { $type: "string", $gt: "" } } },
    );
  }
}


async function migrateMatchTimingFields():Promise<void>{
  const seasons=await SeasonModel.collection.find({}).toArray();
  const matches=mongoose.connection.collection("seasonmatches");
  for(const season of seasons){
    const rules=(season.matchRules??{}) as {defaultMatchDurationMinutes?:number;extraTime?:{defaultDurationMinutes?:number;isAllowedByDefault?:boolean};penaltyShootout?:{isAllowedByDefault?:boolean};knockoutDrawRequiresShootout?:boolean};
    const duration=Number.isInteger(rules.defaultMatchDurationMinutes)&&Number(rules.defaultMatchDurationMinutes)>=10&&Number(rules.defaultMatchDurationMinutes)<=120&&Number(rules.defaultMatchDurationMinutes)%2===0?Number(rules.defaultMatchDurationMinutes):30;
    const extraDuration=Number.isInteger(rules.extraTime?.defaultDurationMinutes)&&Number(rules.extraTime?.defaultDurationMinutes)>0&&Number(rules.extraTime?.defaultDurationMinutes)%2===0?Number(rules.extraTime?.defaultDurationMinutes):10;
    const penaltyDefault=rules.penaltyShootout?.isAllowedByDefault??rules.knockoutDrawRequiresShootout??true;
    await matches.updateMany({seasonRef:season._id,matchDurationMinutes:{$exists:false}},{$set:{matchDurationMinutes:duration}});
    await matches.updateMany({seasonRef:season._id,decidingRules:{$exists:false}},{$set:{decidingRules:{extraTime:{isAllowed:false,durationMinutes:extraDuration},penaltyShootout:{isAllowed:penaltyDefault}}}});
    await matches.updateMany({seasonRef:season._id,phase:{$exists:false}},{$set:{phase:null}});
    await matches.updateMany({seasonRef:season._id,actualStartedAt:{$exists:false}},{$set:{actualStartedAt:null}});
    await matches.updateMany({seasonRef:season._id,clock:{$exists:false}},{$set:{clock:{isRunning:false,clockStartedAt:null,periodElapsedSecondsByPeriod:{firstHalf:0,secondHalf:0,extraTimeFirstHalf:0,extraTimeSecondHalf:0}}}});
    const normalizedRules={groupStageDrawAllowed:(rules as any).groupStageDrawAllowed??true,defaultMatchDurationMinutes:duration,extraTime:{isAllowedByDefault:rules.extraTime?.isAllowedByDefault??false,defaultDurationMinutes:extraDuration},penaltyShootout:{isAllowedByDefault:penaltyDefault},shootoutCountsForMatchScore:false,shootoutCountsForPlayerGoals:false};
    await SeasonModel.collection.updateOne({_id:season._id},{$set:{matchRules:normalizedRules}});
  }
}

async function migrateAuctionLifecycleStatus(): Promise<void> {
  // Read directly from the collection because auctionClosedAt is intentionally
  // no longer part of the current Mongoose schema.
  const legacySeasons = await SeasonModel.collection.find(
    { auctionLifecycleStatus: { $exists: false } },
    { projection: { _id: 1, status: 1, auctionClosedAt: 1 } },
  ).toArray();

  for (const season of legacySeasons) {
    const hasLots = await AuctionLotModel.exists({ seasonRef: season._id });
    const auctionLifecycleStatus = season.auctionClosedAt
      ? "completed"
      : hasLots || season.status === "upcoming" || season.status === "active"
        ? "in_progress"
        : "not_started";
    await SeasonModel.collection.updateOne(
      { _id: season._id, auctionLifecycleStatus: { $exists: false } },
      { $set: { auctionLifecycleStatus }, $unset: { auctionClosedAt: "" } },
    );
  }

  await SeasonModel.collection.updateMany(
    { auctionLifecycleStatus: { $exists: true }, auctionClosedAt: { $exists: true } },
    { $unset: { auctionClosedAt: "" } },
  );
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
