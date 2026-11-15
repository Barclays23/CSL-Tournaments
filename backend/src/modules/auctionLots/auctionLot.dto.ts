import type {AuctionLotStatus} from "./auctionLot.types.js";
import type {SeasonPlayerPosition} from "../seasons/season.types.js";
export interface NominatePlayerDto{seasonId:string;playerId:string;playerPosition:SeasonPlayerPosition;isIconPlayer?:boolean;isGoalkeeper?:boolean;}
export interface SellAuctionLotDto{seasonTeamId:string;purchasePrice:number;jerseyNo?:number|null;}
export interface UpdateAuctionLotStatusDto{auctionStatus:"unsold"|"withdrawn";}
export interface UpdateAuctionLotDto{
 auctionStatus:AuctionLotStatus;
 seasonTeamId?:string|null;
 purchasePrice?:number|null;
 jerseyNo?:number|null;
 playerPosition?:SeasonPlayerPosition;
 isIconPlayer?:boolean;
}
export interface AuctionLotsQueryDto{seasonId:string;seasonTeamId?:string;playerName?:string;playerPosition?:SeasonPlayerPosition;auctionStatus?:AuctionLotStatus;isIconPlayer?:boolean;isGoalkeeper?:boolean;}
export interface AuctionLotResponseDto{_id:string;seasonRef:string;seasonTeamRef:string|null|{_id:string;displayName:string;team:{_id:string;name:string;shortName:string|null;logo:unknown}|null};playerRef:{_id:string;name:string;profilePic:unknown}|string;lotNumber:number|null;auctionStatus:AuctionLotStatus;purchasePrice:number|null;playerPosition:SeasonPlayerPosition;isIconPlayer:boolean;isGoalkeeper:boolean;jerseyNo:number|null;nominatedAt:string|null;soldAt:string|null;}
export interface AuctionTeamSummaryDto{seasonTeamId:string;teamId:string;displayName:string;logoSnapshot:unknown;status:string;budget:number;playersSigned:number;remainingSlots:number;totalSpent:number;balance:number;averagePrice:number;iconCount:number;goalkeeperCount:number;lots:AuctionLotResponseDto[];}
export interface AuctionSummaryDto{season:{_id:string;name:string;year:number;status:string;auctionSettings:unknown};totals:{participatingTeams:number;lots:number;sold:number;pending:number;unsold:number;withdrawn:number;totalSoldValue:number};teams:AuctionTeamSummaryDto[];lots:AuctionLotResponseDto[];}
