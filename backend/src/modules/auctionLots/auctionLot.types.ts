import type { Types } from "mongoose";
import type { Asset } from "../../shared/types/common.types.js";
import type { SeasonPlayerPosition } from "../seasons/season.types.js";

export type AuctionLotStatus = "pending" | "sold" | "unsold" | "withdrawn";

export interface AuctionLotFields {
  seasonRef: Types.ObjectId;
  seasonTeamRef: Types.ObjectId | null;
  playerRef: Types.ObjectId;
  lotNumber: number | null;
  auctionStatus: AuctionLotStatus;
  purchasePrice: number | null;
  playerPosition: SeasonPlayerPosition;
  isIconPlayer: boolean;
  isGoalkeeper: boolean;
  jerseyNo: number | null;
  nominatedAt: Date | null;
  soldAt: Date | null;
}

export interface AuctionLotEntity extends AuctionLotFields {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuctionLotQuery {
  seasonRef: Types.ObjectId;
  seasonTeamRef?: Types.ObjectId;
  playerRef?: Types.ObjectId | { $in: Types.ObjectId[] };
  playerPosition?: SeasonPlayerPosition;
  auctionStatus?: AuctionLotStatus;
  isIconPlayer?: boolean;
  isGoalkeeper?: boolean;
}

export interface PopulatedAuctionLotTeam {
  _id: Types.ObjectId;
  name: string;
  shortName: string | null;
  logo: Asset | null;
}

export interface PopulatedAuctionLotSeasonTeam {
  _id: Types.ObjectId;
  displayName: string;
  logoSnapshot: Asset | null;
  teamRef: Types.ObjectId | PopulatedAuctionLotTeam;
}

export interface PopulatedAuctionLotPlayer {
  _id: Types.ObjectId;
  name: string;
  profilePic: Asset | null;
}

/** Shape returned by the AuctionLot repository after its populate() calls. */
export type PopulatedAuctionLotEntity = Omit<AuctionLotEntity, "playerRef" | "seasonTeamRef"> & {
  playerRef: Types.ObjectId | PopulatedAuctionLotPlayer;
  seasonTeamRef: Types.ObjectId | PopulatedAuctionLotSeasonTeam | null;
};

export interface ISeasonRosterLookupRepository {
  isPlayerSoldToTeamInActiveSeason(playerId: string, teamId: string): Promise<boolean>;
}
