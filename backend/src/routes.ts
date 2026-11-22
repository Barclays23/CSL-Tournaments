import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { userRouter } from "./modules/users/user.routes.js";
import { organizerRouter } from "./modules/organizers/organizer.routes.js";
import { playerRouter } from "./modules/players/player.routes.js";
import { teamRouter } from "./modules/teams/team.routes.js";
import { managerRouter } from "./modules/managers/manager.routes.js";
import { sponsorRouter } from "./modules/sponsors/sponsor.routes.js";
import { statisticsRouter } from "./modules/statistics/statistics.routes.js";
import { uploadRouter } from "./modules/uploads/upload.routes.js";
import { seasonRouter } from "./modules/seasons/season.routes.js";
import { auctionLotRouter } from "./modules/auctionLots/auctionLot.routes.js";
import { auctionsRouter } from "./modules/auctionLots/auction.routes.js";
import { venueRouter } from "./modules/venues/venue.routes.js";
import { newsRouter } from "./modules/news/news.routes.js";



export const apiRouter = Router();



apiRouter.use("/auth",authRouter);
apiRouter.use("/users",userRouter);
apiRouter.use("/organizers",organizerRouter);
apiRouter.use("/players",playerRouter);
apiRouter.use("/teams",teamRouter);
apiRouter.use("/managers",managerRouter);
apiRouter.use("/sponsors",sponsorRouter);
apiRouter.use("/",statisticsRouter);
apiRouter.use("/uploads",uploadRouter);
apiRouter.use("/seasons",seasonRouter);
apiRouter.use("/auction-lots",auctionLotRouter);
apiRouter.use("/auctions",auctionsRouter);
apiRouter.use("/venues", venueRouter);
apiRouter.use("/news", newsRouter);
