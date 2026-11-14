import type {ControllerMethod} from "../../shared/types/common.types.js";
import type {NominatePlayerDto,SellAuctionLotDto,UpdateAuctionLotStatusDto,AuctionSummaryDto,AuctionLotResponseDto,AuctionLotsQueryDto} from "./auctionLot.dto.js";
export interface IAuctionLotService{summary(seasonId:string):Promise<AuctionSummaryDto>;list(query:AuctionLotsQueryDto):Promise<AuctionLotResponseDto[]>;nominate(input:NominatePlayerDto):Promise<AuctionLotResponseDto>;sell(id:string,input:SellAuctionLotDto):Promise<AuctionLotResponseDto>;updateStatus(id:string,input:UpdateAuctionLotStatusDto):Promise<AuctionLotResponseDto>;}
export interface IAuctionLotController{summary:ControllerMethod;list:ControllerMethod;nominate:ControllerMethod;sell:ControllerMethod;updateStatus:ControllerMethod;}
