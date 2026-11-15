export interface CreateGroupDto{groupName:string;displayOrder?:number;}
export interface UpdateGroupDto{groupName?:string;displayOrder?:number;}
export interface GroupResponseDto{_id:string;seasonRef:string;groupName:string;displayOrder:number;createdAt:string;updatedAt:string;}
