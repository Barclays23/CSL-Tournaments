import { UserRepository } from "../modules/users/user.repository.js";
import { SettingsRepository } from "../modules/settings/settings.repository.js";
import { PlayerRepository } from "../modules/players/player.repository.js";
import { TeamRepository } from "../modules/teams/team.repository.js";
import { ManagerRepository } from "../modules/managers/manager.repository.js";
import { SponsorRepository } from "../modules/sponsors/sponsor.repository.js";
import { MatchRepository } from "../modules/matches/match.repository.js";
import { StatisticsRepository } from "../modules/statistics/statistics.repository.js";

import { AuthService } from "../modules/auth/auth.service.js";
import { UserService } from "../modules/users/user.service.js";
import { UserController } from "../modules/users/user.controller.js";
import { OrganizerRepository } from "../modules/organizers/organizer.repository.js";
import { OrganizerService } from "../modules/organizers/organizer.service.js";
import { OrganizerController } from "../modules/organizers/organizer.controller.js";
import { SettingsService } from "../modules/settings/settings.service.js";
import { PlayerService } from "../modules/players/player.service.js";
import { TeamService } from "../modules/teams/team.service.js";
import { ManagerService } from "../modules/managers/manager.service.js";
import { SponsorService } from "../modules/sponsors/sponsor.service.js";
import { MatchService } from "../modules/matches/match.service.js";
import { StatisticsService } from "../modules/statistics/statistics.service.js";
import { AuctionService } from "../modules/auction/auction.service.js";
import { UploadService } from "../modules/uploads/upload.service.js";

import { AuthController } from "../modules/auth/auth.controller.js";
import { SettingsController } from "../modules/settings/settings.controller.js";
import { PlayerController } from "../modules/players/player.controller.js";
import { TeamController } from "../modules/teams/team.controller.js";
import { ManagerController } from "../modules/managers/manager.controller.js";
import { SponsorController } from "../modules/sponsors/sponsor.controller.js";
import { MatchController } from "../modules/matches/match.controller.js";
import { StatisticsController } from "../modules/statistics/statistics.controller.js";
import { AuctionController } from "../modules/auction/auction.controller.js";
import { UploadController } from "../modules/uploads/upload.controller.js";

import type { IUserRepository, IUserService } from "../modules/users/user.interfaces.js";
import type { IAuthService, IAuthController } from "../modules/auth/auth.interfaces.js";
import type { ISettingsRepository, ISettingsService, ISettingsController } from "../modules/settings/settings.interfaces.js";
import type { IPlayerRepository, IPlayerService, IPlayerController } from "../modules/players/player.interfaces.js";
import type { ITeamRepository, ITeamService, ITeamController } from "../modules/teams/team.interfaces.js";
import type { IManagerRepository, IManagerService, IManagerController } from "../modules/managers/manager.interfaces.js";
import type { ISponsorRepository, ISponsorService, ISponsorController } from "../modules/sponsors/sponsor.interfaces.js";
import type { IMatchRepository, IMatchService, IMatchController } from "../modules/matches/match.interfaces.js";
import type { IStatisticsRepository, IStatisticsService, IStatisticsController } from "../modules/statistics/statistics.interfaces.js";
import type { IAuctionService, IAuctionController } from "../modules/auction/auction.interfaces.js";
import type { IUploadService, IUploadController } from "../modules/uploads/upload.interfaces.js";





// ============================================================================
// 1. REPOSITORIES
// ============================================================================
const userRepo: IUserRepository             = new UserRepository();
const settingsRepo: ISettingsRepository     = new SettingsRepository();
const playerRepo: IPlayerRepository         = new PlayerRepository();
const teamRepo: ITeamRepository             = new TeamRepository();
const managerRepo: IManagerRepository       = new ManagerRepository();
const sponsorRepo: ISponsorRepository       = new SponsorRepository();
const matchRepo: IMatchRepository           = new MatchRepository();
const statisticsRepo: IStatisticsRepository = new StatisticsRepository();



// ============================================================================
// 2. CORE & INDEPENDENT SERVICES (Level 0 / Level 1 Dependencies)
// ============================================================================
const uploadService: IUploadService     = new UploadService();
export const settingsService: ISettingsService = new SettingsService(settingsRepo);
export const userService: IUserService         = new UserService(userRepo);
export const userController = new UserController(userService);
const organizerRepository = new OrganizerRepository();
const organizerService = new OrganizerService(organizerRepository);
export const organizerController = new OrganizerController(organizerService);
const authService: IAuthService         = new AuthService(userRepo);
const sponsorService: ISponsorService   = new SponsorService(sponsorRepo);




// ============================================================================
// 3. DOMAIN SERVICES (Level 2+ Cross-Module Dependencies)
// ============================================================================
const playerService: IPlayerService         = new PlayerService(playerRepo, teamRepo, settingsService);
const teamService: ITeamService             = new TeamService(teamRepo, playerRepo, settingsService);
const managerService: IManagerService       = new ManagerService(managerRepo, teamRepo);
const matchService: IMatchService           = new MatchService(matchRepo, teamRepo, playerRepo);
const statisticsService: IStatisticsService = new StatisticsService(statisticsRepo, settingsService, playerRepo, teamRepo);
const auctionService: IAuctionService       = new AuctionService(settingsService, teamRepo, playerRepo);




// ============================================================================
// 4. CONTROLLERS (Exported for Route Files)
// ============================================================================
export const authController: IAuthController             = new AuthController(authService);
export const settingsController: ISettingsController     = new SettingsController(settingsService);
export const playerController: IPlayerController         = new PlayerController(playerService);
export const teamController: ITeamController             = new TeamController(teamService, statisticsService);
export const managerController: IManagerController       = new ManagerController(managerService);
export const sponsorController: ISponsorController       = new SponsorController(sponsorService);
export const matchController: IMatchController           = new MatchController(matchService);
export const statisticsController: IStatisticsController = new StatisticsController(statisticsService);
export const auctionController: IAuctionController       = new AuctionController(auctionService);
export const uploadController: IUploadController         = new UploadController(uploadService);
import { SeasonRepository } from "../modules/seasons/season.repository.js";
import { SeasonService } from "../modules/seasons/season.service.js";
import { SeasonController } from "../modules/seasons/season.controller.js";
import { SeasonTeamRepository } from "../modules/seasonTeams/seasonTeam.repository.js";
import { AuctionLotRepository } from "../modules/auctionLots/auctionLot.repository.js";
import { AuctionLotService } from "../modules/auctionLots/auctionLot.service.js";
import { AuctionLotController } from "../modules/auctionLots/auctionLot.controller.js";

const seasonTeamRepository = new SeasonTeamRepository();
const seasonRepository = new SeasonRepository();
const seasonService = new SeasonService(seasonRepository, teamRepo, seasonTeamRepository);
export const seasonController = new SeasonController(seasonService);
const auctionLotRepository = new AuctionLotRepository();
const auctionLotService = new AuctionLotService(auctionLotRepository);
export const auctionLotController = new AuctionLotController(auctionLotService);

import { SeasonTeamService } from "../modules/seasonTeams/seasonTeam.service.js";
import { SeasonTeamController } from "../modules/seasonTeams/seasonTeam.controller.js";
import { GroupRepository } from "../modules/groups/group.repository.js";
import { GroupService } from "../modules/groups/group.service.js";
import { GroupController } from "../modules/groups/group.controller.js";

const seasonTeamService = new SeasonTeamService(seasonTeamRepository);
export const seasonTeamController = new SeasonTeamController(seasonTeamService);
const groupRepository = new GroupRepository();
const groupService = new GroupService(groupRepository);
export const groupController = new GroupController(groupService);

import { SeasonMatchRepository } from "../modules/matches/seasonMatch.repository.js";
import { SeasonMatchService } from "../modules/matches/seasonMatch.service.js";
import { SeasonMatchController } from "../modules/matches/seasonMatch.controller.js";
const seasonMatchRepository = new SeasonMatchRepository();
const seasonMatchService = new SeasonMatchService(seasonMatchRepository);
export const seasonMatchController = new SeasonMatchController(seasonMatchService);

import { SeasonStatisticsRepository } from "../modules/statistics/seasonStatistics.repository.js";
import { SeasonStatisticsService } from "../modules/statistics/seasonStatistics.service.js";
import { SeasonStatisticsController } from "../modules/statistics/seasonStatistics.controller.js";
const seasonStatisticsRepository = new SeasonStatisticsRepository();
const seasonStatisticsService = new SeasonStatisticsService(seasonStatisticsRepository);
export const seasonStatisticsController = new SeasonStatisticsController(seasonStatisticsService);

import { SeasonAwardRepository } from "../modules/seasonAwards/seasonAward.repository.js";
import { SeasonAwardService } from "../modules/seasonAwards/seasonAward.service.js";
import { SeasonAwardController } from "../modules/seasonAwards/seasonAward.controller.js";
const seasonAwardRepository = new SeasonAwardRepository();
const seasonAwardService = new SeasonAwardService(seasonAwardRepository);
export const seasonAwardController = new SeasonAwardController(seasonAwardService);
