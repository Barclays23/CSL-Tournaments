import "dotenv/config";
import mongoose from "mongoose";
import { appConfig } from "../config/env.config.js";

const normalize = (value: unknown) => String(value ?? "").trim().normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase("en");

async function migrate(): Promise<void> {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(appConfig.MONGODB_URI);
  try {
    const matches = mongoose.connection.collection("seasonmatches");
    const venues = mongoose.connection.collection("venues");
    const rows = await matches.find({}).toArray();
    const venueRows = await venues.find({}).toArray();
    const byName = new Map<string, any>();
    for (const venue of venueRows) byName.set(venue.normalizedName || normalize(venue.name), venue);
    const plans: Array<{ matchId: string; venueName: string; venueId: string; roundNumber: number }> = [];
    let unresolvedFixtures = 0;
    const newVenues: any[] = [];
    for (const match of rows) {
      const venueName = String(match.venue ?? "").trim();
      let venue = match.venueRef ? venueRows.find(item => String(item._id) === String(match.venueRef)) : undefined;
      if (!venue && venueName) {
        const key = normalize(venueName);
        venue = byName.get(key);
        if (!venue) {
          venue = { _id: new mongoose.Types.ObjectId(), name: venueName, normalizedName: key, location: null, notes: "Migrated from existing fixture venue", status: "active", createdAt: new Date(), updatedAt: new Date() };
          byName.set(key, venue);
          newVenues.push(venue);
        }
      }
      if (!venue) {
        console.error("Fixture has no venue and cannot be migrated automatically:", String(match._id));
        unresolvedFixtures += 1;
        process.exitCode = 2;
        continue;
      }
      const roundNumber = Number.isInteger(match.roundNumber) && match.roundNumber > 0 ? match.roundNumber : 1;
      if (!match.venueRef || !match.roundNumber || match.venue !== undefined) plans.push({ matchId: String(match._id), venueName: venue.name, venueId: String(venue._id), roundNumber });
    }
    if (apply && unresolvedFixtures > 0) throw new Error(`Cannot apply migration: ${unresolvedFixtures} fixture(s) have no venue name to migrate. No database records were changed.`);
    if (apply && newVenues.length) await venues.insertMany(newVenues, { ordered: true });
    if (apply) {
      for (const plan of plans) {
        await matches.updateOne({ _id: new mongoose.Types.ObjectId(plan.matchId) }, {
          $set: { venueRef: new mongoose.Types.ObjectId(plan.venueId), roundNumber: plan.roundNumber },
          $unset: { venue: "" },
        });
      }
    }
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", fixturesToUpdate: plans.length, venuesToCreate: newVenues.map(v => v.name), changes: plans }, null, 2));
    if (!apply) console.log("Dry run only. Run with --apply to create venue master records and link existing fixtures.");
  } finally { await mongoose.disconnect(); }
}
migrate().catch((error: unknown) => { console.error("Season fixture venue migration failed", error); process.exitCode = 1; });
