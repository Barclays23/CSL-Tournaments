import {Router} from "express";
import {authenticate} from "../../middlewares/authenticate.middleware.js";
import {requireAdmin} from "../../middlewares/authorizeAdmin.middleware.js";
import {auctionLotController} from "../../container/dependencies.js";
export const auctionLotRouter=Router();
auctionLotRouter.get("/",auctionLotController.summary);
auctionLotRouter.post("/",authenticate,requireAdmin,auctionLotController.nominate);
auctionLotRouter.patch("/:id/sell",authenticate,requireAdmin,auctionLotController.sell);
auctionLotRouter.patch("/:id/status",authenticate,requireAdmin,auctionLotController.updateStatus);
