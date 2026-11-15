import "dotenv/config";
import mongoose from "mongoose";
import { appConfig } from "../config/env.config.js";

/**
 * Renames legacy season date fields without losing existing values.
 * If both old and new fields exist with different values, the document is
 * reported and left untouched for manual reconciliation.
 */
async function migrate(): Promise<void> {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(appConfig.MONGODB_URI);
  try {
    const seasons = mongoose.connection.collection("seasons");
    const cursor = seasons.find({
      $or: [
        { startDateTime: { $exists: true } },
        { endDateTime: { $exists: true } },
      ],
    });
    let migrated = 0;
    const conflicts: string[] = [];
    for await (const season of cursor) {
      const updates: Record<string, unknown> = {};
      const unset: Record<string, ""> = {};
      for (const [legacy, current] of [["startDateTime", "startDate"], ["endDateTime", "endDate"]] as const) {
        const oldValue = season[legacy];
        if (oldValue === undefined || oldValue === null) {
          unset[legacy] = "";
          continue;
        }
        const currentValue = season[current];
        if (currentValue !== undefined && currentValue !== null &&
            new Date(currentValue as Date).getTime() !== new Date(oldValue as Date).getTime()) {
          conflicts.push(String(season._id));
          continue;
        }
        if (currentValue === undefined || currentValue === null) updates[current] = oldValue;
        unset[legacy] = "";
      }
      if (Object.keys(updates).length || Object.keys(unset).length) {
        migrated += 1;
        if (apply) await seasons.updateOne({ _id: season._id }, {
          ...(Object.keys(updates).length ? { $set: updates } : {}),
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        });
      }
    }
    console.log(`${apply ? "Migrated" : "Would migrate"} ${migrated} season document(s).`);
    if (conflicts.length) console.error("Date conflicts require manual review for season IDs:", [...new Set(conflicts)]);
    if (!apply) console.log("Dry run only. Rerun with --apply after reviewing conflicts.");
    if (conflicts.length) process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
  }
}
migrate().catch((error: unknown) => {
  console.error("Season date migration failed", error);
  process.exitCode = 1;
});
