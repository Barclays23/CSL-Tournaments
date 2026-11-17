import type {ControllerMethod} from "../../shared/types/common.types.js";
import type {UpdateSeasonTeamDto,SeasonTeamResponseDto} from "./seasonTeam.dto.js";
export interface ISeasonTeamService{list(seasonId:string):Promise<SeasonTeamResponseDto[]>;update(seasonId:string,id:string,input:UpdateSeasonTeamDto):Promise<SeasonTeamResponseDto>;remove(seasonId:string,id:string):Promise<void>;withdraw(seasonId:string,id:string):Promise<SeasonTeamResponseDto>;recall(seasonId:string,id:string,reason:string):Promise<SeasonTeamResponseDto>;}
export interface ISeasonTeamController{list:ControllerMethod;update:ControllerMethod;remove:ControllerMethod;withdraw:ControllerMethod;recall:ControllerMethod;}
