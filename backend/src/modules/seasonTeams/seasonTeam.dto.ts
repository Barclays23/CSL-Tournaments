import type {Asset} from "../../shared/types/common.types.js";
import type {SeasonTeamStatus} from "./seasonTeam.types.js";
export interface UpdateSeasonTeamDto{managerIds?:string[];groupId?:string|null;}
export interface SeasonTeamResponseDto{
 _id:string;seasonRef:string;teamRef:string;displayName:string;logoSnapshot:Asset|null;groupRef:string|null;
 managerRefs:string[];status:SeasonTeamStatus;participationHistory?:Array<{fromStatus:string;toStatus:string;reason:string;changedAt:string}>;team:{_id:string;name:string;shortName:string|null;logo:Asset|null}|null;
 group:{_id:string;groupName:string;displayOrder:number}|null;
 managers:Array<{_id:string;name:string;role:string|null;profilePic:Asset|null}>;
 createdAt:string;updatedAt:string;
}
