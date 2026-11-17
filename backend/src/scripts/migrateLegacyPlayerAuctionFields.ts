import mongoose, { Types } from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.config.js";
import { appConfig } from "../config/env.config.js";
import { PlayerModel } from "../modules/players/player.model.js";
import { SeasonModel } from "../modules/seasons/season.model.js";
import { SeasonTeamModel } from "../modules/seasonTeams/seasonTeam.model.js";
import { AuctionLotModel } from "../modules/auctionLots/auctionLot.model.js";
import type { AuctionLotFields } from "../modules/auctionLots/auctionLot.types.js";

const legacyPositionMap = {
  GK: "goalkeeper",
  DF: "defender",
  MF: "midfielder",
  FW: "forward",
  goalkeeper: "goalkeeper",
  defender: "defender",
  midfielder: "midfielder",
  forward: "forward",
} as const;

async function migrateLegacyPlayerAuctionFields(): Promise<void> {
  await connectDatabase(appConfig.MONGODB_URI);
  const apply = process.argv.includes("--apply");
  const summary = { wouldMigrate: 0, migrated: 0, alreadySeasonLinked: 0, profileOnly: 0, skippedForReview: 0 };

  try {
    const activeSeason = await SeasonModel.findOne({ status: "active" }).select("_id").lean<{ _id: Types.ObjectId } | null>().exec();
    if (!activeSeason) {
      console.log("No active season exists. Legacy Player auction fields were left untouched.");
      if (apply) {
        const indexes = await PlayerModel.syncIndexes();
        console.log("Player indexes synchronized:", indexes);
      }
      return;
    }

    const legacyPlayers = await PlayerModel.collection.find({
      $or: [
        { position: { $exists: true } }, { isIconPlayer: { $exists: true } },
        { teamRef: { $exists: true } }, { jerseyNo: { $exists: true } },
        { auctionPrice: { $exists: true } }, { auctionStatus: { $exists: true } },
        { isGoalkeeper: { $exists: true } },
      ],
    }).toArray();

    for (const player of legacyPlayers) {
      const playerId = player._id as Types.ObjectId;
      const existingLot = await AuctionLotModel.findOne({ seasonRef: activeSeason._id, playerRef: playerId }).select("_id").lean().exec();
      const legacyStatus = player.auctionStatus ?? "pending";
      const legacyTeamId = player.teamRef ? new Types.ObjectId(String(player.teamRef)) : null;
      const legacyPrice = Number(player.auctionPrice ?? 0);
      const legacyJersey = player.jerseyNo == null ? null : Number(player.jerseyNo);
      const hasAuctionState = legacyStatus !== "pending" || Boolean(legacyTeamId) ||
        legacyPrice > 0 || legacyJersey !== null || Boolean(player.isIconPlayer) || Boolean(player.isGoalkeeper);

      let lotData: AuctionLotFields | null = null;
      if (existingLot) {
        summary.alreadySeasonLinked += 1;
      } else if (hasAuctionState) {
        const playerPosition = legacyPositionMap[player.position as keyof typeof legacyPositionMap];
        if (!playerPosition || !["pending", "sold", "unsold"].includes(legacyStatus)) {
          summary.skippedForReview += 1;
          console.warn(`Skipped Player ${playerId}: legacy position or auction status needs manual review.`);
          continue;
        }

        let seasonTeamRef: Types.ObjectId | null = null;
        let purchasePrice: number | null = null;
        let jerseyNo: number | null = null;
        if (legacyStatus === "sold") {
          if (!legacyTeamId || !Number.isFinite(legacyPrice) || legacyPrice < 0) {
            summary.skippedForReview += 1;
            console.warn(`Skipped Player ${playerId}: sold legacy record has no valid team or purchase price.`);
            continue;
          }
          const seasonTeam = await SeasonTeamModel.findOne({
            seasonRef: activeSeason._id, teamRef: legacyTeamId, status: { $ne: "withdrawn" },
          }).select("_id").lean<{ _id: Types.ObjectId } | null>().exec();
          if (!seasonTeam) {
            summary.skippedForReview += 1;
            console.warn(`Skipped Player ${playerId}: legacy team is not registered in the active season.`);
            continue;
          }
          if (legacyJersey !== null && (!Number.isInteger(legacyJersey) || legacyJersey < 1 || legacyJersey > 99)) {
            summary.skippedForReview += 1;
            console.warn(`Skipped Player ${playerId}: legacy jersey number is outside the supported range.`);
            continue;
          }
          seasonTeamRef = seasonTeam._id;
          purchasePrice = legacyPrice;
          jerseyNo = legacyJersey;
        } else if (legacyTeamId || legacyPrice > 0 || legacyJersey !== null) {
          summary.skippedForReview += 1;
          console.warn(`Skipped Player ${playerId}: non-sold legacy record contains sale-only values.`);
          continue;
        }

        lotData = {
          seasonRef: activeSeason._id,
          seasonTeamRef,
          playerRef: playerId,
          lotNumber: null,
          auctionStatus: legacyStatus,
          purchasePrice,
          playerPosition,
          isIconPlayer: Boolean(player.isIconPlayer),
          isGoalkeeper: player.isGoalkeeper === undefined ? playerPosition === "goalkeeper" : Boolean(player.isGoalkeeper),
          jerseyNo,
          nominatedAt: null,
          soldAt: null,
        };
      } else {
        summary.profileOnly += 1;
      }

      if (!apply) {
        if (lotData) summary.wouldMigrate += 1;
        continue;
      }

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const lotNowExists = await AuctionLotModel.findOne({
            seasonRef: activeSeason._id, playerRef: playerId,
          }).session(session).select("_id").lean().exec();
          if (!lotNowExists && lotData) {
            await AuctionLotModel.create([lotData], { session });
          }
          await PlayerModel.collection.updateOne(
            { _id: playerId },
            { $unset: {
              position: "", isIconPlayer: "", teamRef: "", jerseyNo: "",
              auctionPrice: "", auctionStatus: "", isGoalkeeper: "",
            } },
            { session },
          );
        });
        if (lotData) summary.migrated += 1;
      } finally {
        await session.endSession();
      }
    }

    if (apply) {
      const indexes = await PlayerModel.syncIndexes();
      console.log("Player indexes synchronized:", indexes);
    }
    console.log(`Legacy Player auction-field migration ${apply ? "applied" : "dry-run"}:`, summary);
    if (!apply) console.log("No records were modified. Re-run with --apply after reviewing the output.");
    if (summary.skippedForReview > 0) {
      console.warn("Review skipped records before removing any remaining legacy fields.");
    }
  } finally {
    await disconnectDatabase();
  }
}

migrateLegacyPlayerAuctionFields().catch((error: unknown) => {
  console.error("Legacy Player migration failed", error);
  process.exitCode = 1;
});
