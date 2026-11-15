import type {Types} from "mongoose";
export interface GroupFields{seasonRef:Types.ObjectId;groupName:string;normalizedGroupName?:string;displayOrder:number;}
export interface GroupEntity extends GroupFields{_id:Types.ObjectId;createdAt:Date;updatedAt:Date;}
