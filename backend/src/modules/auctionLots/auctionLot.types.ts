import type {Types} from "mongoose";
import type {SeasonPlayerPosition} from "../seasons/season.types.js";
export type AuctionLotStatus="pending"|"sold"|"unsold"|"withdrawn";
export interface AuctionLotFields{seasonRef:Types.ObjectId;seasonTeamRef:Types.ObjectId|null;playerRef:Types.ObjectId;lotNumber:number|null;auctionStatus:AuctionLotStatus;purchasePrice:number|null;playerPosition:SeasonPlayerPosition;isIconPlayer:boolean;isGoalkeeper:boolean;jerseyNo:number|null;nominatedAt:Date|null;soldAt:Date|null;}
export interface AuctionLotEntity extends AuctionLotFields{_id:Types.ObjectId;createdAt:Date;updatedAt:Date;}
export interface AuctionLotQuery{seasonRef:Types.ObjectId;seasonTeamRef?:Types.ObjectId;playerRef?:Types.ObjectId|{$in:Types.ObjectId[]};playerPosition?:SeasonPlayerPosition;auctionStatus?:AuctionLotStatus;isIconPlayer?:boolean;isGoalkeeper?:boolean;}
