import type {Request,Response,NextFunction} from "express";
import {ApiResponse} from "../../utils/apiResponse.utils.js";
import {getRequiredRouteParam} from "../../shared/utils/routeParams.js";
import {nominatePlayerSchema,sellAuctionLotSchema,auctionLotStatusSchema,updateAuctionLotSchema,auctionQuerySchema} from "./auctionLot.schema.js";
import type {IAuctionLotService} from "./auctionLot.interfaces.js";
export class AuctionLotController{
 constructor(private readonly service:IAuctionLotService){}
 summary=async(req:Request,res:Response,next:NextFunction)=>{try{const q=auctionQuerySchema.parse({seasonId:req.query.seasonId});res.status(200).json(ApiResponse.success("Auction summary fetched",await this.service.summary(q.seasonId)));}catch(e){next(e);}};
 list=async(req:Request,res:Response,next:NextFunction)=>{try{const q=auctionQuerySchema.parse(req.query);res.status(200).json(ApiResponse.success("Auction lots fetched",await this.service.list(q)));}catch(e){next(e);}};
 nominate=async(req:Request,res:Response,next:NextFunction)=>{try{res.status(201).json(ApiResponse.success("Player nominated",await this.service.nominate(nominatePlayerSchema.parse(req.body))));}catch(e){next(e);}};
 sell=async(req:Request,res:Response,next:NextFunction)=>{try{res.status(200).json(ApiResponse.success("Auction lot sold",await this.service.sell(getRequiredRouteParam(req.params.id, "id"),sellAuctionLotSchema.parse(req.body))));}catch(e){next(e);}};
 updateStatus=async(req:Request,res:Response,next:NextFunction)=>{try{res.status(200).json(ApiResponse.success("Auction lot status updated",await this.service.updateStatus(getRequiredRouteParam(req.params.id, "id"),auctionLotStatusSchema.parse(req.body))));}catch(e){next(e);}};
 deletePending=async(req:Request,res:Response,next:NextFunction)=>{try{await this.service.deletePending(getRequiredRouteParam(req.params.id, "id"));res.status(200).json(ApiResponse.success("Pending auction lot removed",null));}catch(e){next(e);}};
 update=async(req:Request,res:Response,next:NextFunction)=>{try{res.status(200).json(ApiResponse.success("Auction lot updated",await this.service.update(getRequiredRouteParam(req.params.id, "id"),updateAuctionLotSchema.parse(req.body))));}catch(e){next(e);}};
}
