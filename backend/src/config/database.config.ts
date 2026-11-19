import mongoose from "mongoose";
import { PlayerModel } from "../modules/players/player.model.js";

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  await ensureOptionalPlayerMobileIndex();
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

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
