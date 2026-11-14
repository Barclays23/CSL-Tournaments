import type {ControllerMethod} from "../../shared/types/common.types.js";
import type {SeasonStandingsDto,SeasonTopScorersDto,SeasonTeamDashboardDto,PlayerHistoryDto} from "./seasonStatistics.dto.js";
export interface ISeasonStatisticsService{getStandings(seasonId:string):Promise<SeasonStandingsDto>;getTopScorers(seasonId:string):Promise<SeasonTopScorersDto>;getTeamDashboard(teamId:string,seasonId:string):Promise<SeasonTeamDashboardDto>;getPlayerHistory(playerId:string):Promise<PlayerHistoryDto>;}
export interface ISeasonStatisticsController{getStandings:ControllerMethod;getTopScorers:ControllerMethod;getTeamDashboard:ControllerMethod;getPlayerHistory:ControllerMethod;}
