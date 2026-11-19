import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { requireAdmin } from "../../middlewares/authorizeAdmin.middleware.js";
import { auctionLotController } from "../../container/dependencies.js";

export const auctionLotRouter = Router();

// Canonical mutation routes. The read/list and summary endpoints remain under /auctions.
auctionLotRouter.post("/", authenticate, requireAdmin, auctionLotController.nominate);
auctionLotRouter.delete("/:id", authenticate, requireAdmin, auctionLotController.deletePending);
auctionLotRouter.patch("/:id/sell", authenticate, requireAdmin, auctionLotController.sell);
auctionLotRouter.patch("/:id/status", authenticate, requireAdmin, auctionLotController.updateStatus);
auctionLotRouter.patch("/:id", authenticate, requireAdmin, auctionLotController.update);
