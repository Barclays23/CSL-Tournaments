import "dotenv/config";
import mongoose from "mongoose";
import { writeFile } from "node:fs/promises";
import { appConfig } from "../config/env.config.js";
import { TeamModel } from "../modules/teams/team.model.js";
import { SeasonModel } from "../modules/seasons/season.model.js";

/**
 * Safe legacy-field migration.
 *
 * Team.groupName was global and cannot be assigned to a particular historical
 * season without verified source information. This migration exports every
 * legacy assignment to a JSON backup and only then removes the permanent field.
 * It deliberately does NOT manufacture Group/SeasonTeam relationships.
 *
 * Run without --apply to preview. Run with --apply only after reviewing the
 * generated backup and manually reconciling any season-specific memberships.
 */
async function migrate(): Promise<void> {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(appConfig.MONGODB_URI);
  try {
    const [teams, seasons] = await Promise.all([
      TeamModel.collection.find({ groupName: { $exists: true, $nin: [null, ""] } }).toArray(),
      SeasonModel.collection.find({}, { projection: { _id: 1, seasonNumber: 1, name: 1, year: 1 } }).toArray(),
    ]);
    const backup = {
      exportedAt: new Date().toISOString(),
      note: "Legacy Team.groupName is not season-specific. Reconcile against verified records before assigning SeasonTeam.groupRef.",
      seasons: seasons.map((season) => ({
        _id: String(season._id), seasonNumber: season.seasonNumber, name: season.name, year: season.year,
      })),
      teams: teams.map((team) => ({
        _id: String(team._id), name: team.name, groupName: team.groupName,
      })),
    };
    const backupPath = `legacy-team-group-assignments-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    await writeFile(backupPath, JSON.stringify(backup, null, 2), { flag: "wx" });
    console.log(`Exported ${teams.length} legacy assignments to ${backupPath}`);
    if (!apply) {
      console.log("Dry run only. Review the backup, then rerun with --apply to unset Team.groupName.");
      return;
    }
    const result = await TeamModel.collection.updateMany(
      { groupName: { $exists: true } },
      { $unset: { groupName: "" } },
    );
    console.log(`Removed legacy groupName from ${result.modifiedCount} Team document(s).`);
  } finally {
    await mongoose.disconnect();
  }
}

migrate().catch((error: unknown) => {
  console.error("Legacy Team.groupName migration failed", error);
  process.exitCode = 1;
});
