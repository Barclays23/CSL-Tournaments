import "dotenv/config";
import mongoose from "mongoose";
import { appConfig } from "../config/env.config.js";

const normalize = (value: unknown): string => String(value ?? "").trim().replace(/\\s+/g, " ").toLocaleLowerCase("en");

async function migrate(): Promise<void> {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(appConfig.MONGODB_URI);
  try {
    const seasons = mongoose.connection.collection("seasons");
    const groups = mongoose.connection.collection("groups");
    let seasonUpdated = 0;
    let groupUpdated = 0;
    const seasonDuplicates: Array<{ normalizedName: string; ids: string[] }> = [];
    const groupDuplicates: Array<{ seasonRef: string; normalizedGroupName: string; ids: string[] }> = [];
    const seasonRows = await seasons.find({}).toArray();
    const seasonBuckets = new Map<string, string[]>();
    for (const row of seasonRows) {
      const normalizedName = normalize(row.name);
      if (!normalizedName) continue;
      seasonBuckets.set(normalizedName, [...(seasonBuckets.get(normalizedName) ?? []), String(row._id)]);
    }
    for (const [normalizedName, ids] of seasonBuckets) {
      if (ids.length > 1) { seasonDuplicates.push({ normalizedName, ids }); continue; }
      const row = seasonRows.find((item) => String(item._id) === ids[0]);
      if (row && row.normalizedName !== normalizedName) {
        seasonUpdated += 1;
        if (apply) await seasons.updateOne({ _id: row._id }, { $set: { normalizedName } });
      }
    }
    const groupRows = await groups.find({}).toArray();
    const groupBuckets = new Map<string, string[]>();
    for (const row of groupRows) {
      const normalizedGroupName = normalize(row.groupName);
      if (!normalizedGroupName) continue;
      const key = String(row.seasonRef) + "::" + normalizedGroupName;
      groupBuckets.set(key, [...(groupBuckets.get(key) ?? []), String(row._id)]);
    }
    for (const [key, ids] of groupBuckets) {
      if (ids.length > 1) {
        const [seasonRef, normalizedGroupName] = key.split("::");
        groupDuplicates.push({ seasonRef, normalizedGroupName, ids });
        continue;
      }
      const row = groupRows.find((item) => String(item._id) === ids[0]);
      const normalizedGroupName = normalize(row?.groupName);
      if (row && row.normalizedGroupName !== normalizedGroupName) {
        groupUpdated += 1;
        if (apply) await groups.updateOne({ _id: row._id }, { $set: { normalizedGroupName } });
      }
    }
    console.log(JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      seasonDocumentsToUpdate: seasonUpdated,
      groupDocumentsToUpdate: groupUpdated,
      seasonNameCollisions: seasonDuplicates,
      seasonScopedGroupNameCollisions: groupDuplicates,
    }, null, 2));
    if (!apply) console.log("Dry run only; no MongoDB records were modified.");
    if (seasonDuplicates.length || groupDuplicates.length) process.exitCode = 2;
  } finally { await mongoose.disconnect(); }
}
migrate().catch((error: unknown) => { console.error("Season identity migration failed", error); process.exitCode = 1; });
