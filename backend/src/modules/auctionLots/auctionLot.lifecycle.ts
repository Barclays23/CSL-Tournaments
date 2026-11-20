import type { AuctionLifecycleStatus, SeasonStatus } from "../seasons/season.types.js";
import type { AuctionLotStatus } from "./auctionLot.types.js";

const writableSeasonStatuses: SeasonStatus[] = ["upcoming", "active"];

export function canUpdateAuctionLot(
  seasonStatus: SeasonStatus,
  auctionLifecycleStatus: AuctionLifecycleStatus,
  currentStatus: AuctionLotStatus,
  nextStatus: AuctionLotStatus,
): boolean {
  if (!writableSeasonStatuses.includes(seasonStatus)) return false;
  if (auctionLifecycleStatus === "in_progress") return true;

  return auctionLifecycleStatus === "not_started"
    && currentStatus === "pending"
    && nextStatus === "pending";
}

export function canDeletePendingAuctionLot(
  seasonStatus: SeasonStatus,
  auctionLifecycleStatus: AuctionLifecycleStatus,
  lotStatus: AuctionLotStatus,
): boolean {
  return writableSeasonStatuses.includes(seasonStatus)
    && (auctionLifecycleStatus === "not_started" || auctionLifecycleStatus === "in_progress")
    && lotStatus === "pending";
}
