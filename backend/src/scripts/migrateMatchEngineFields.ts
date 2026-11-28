import "dotenv/config";
import mongoose from "mongoose";
import { appConfig } from "../config/env.config.js";
import { runMatchEngineMigration, type LegacyMatchDocument, type LegacySeasonDocument, type MigrationCollection } from "./migrateMatchEngineFields.logic.js";
async function migrate():Promise<void>{
 const apply=process.argv.includes("--apply");
 await mongoose.connect(appConfig.MONGODB_URI);
 try{
  const seasons=mongoose.connection.collection("seasons") as unknown as MigrationCollection<LegacySeasonDocument>;
  const matches=mongoose.connection.collection("seasonmatches") as unknown as MigrationCollection<LegacyMatchDocument>;
  const report=await runMatchEngineMigration(seasons,matches,apply);
  console.log(JSON.stringify({mode:apply?"apply":"dry-run",...report},null,2));
  if(!apply)console.log("Dry run only. No database records were changed. Review unresolved records; rerun with --apply to write safe defaults.");
  if(report.unresolvedMatches.length||report.unresolvedSeasons.length||report.updateConflicts)process.exitCode=2;
 }finally{await mongoose.disconnect();}
}
migrate().catch((error:unknown)=>{console.error("Match Engine migration failed",error);process.exitCode=1;});
