import {Types} from "mongoose";
import {GroupModel} from "./group.model.js";
import type {GroupEntity,GroupFields} from "./group.types.js";
export const normalizeGroupName=(name:string):string=>name.trim().replace(/\s+/g," ").toLocaleLowerCase("en");
export class GroupRepository{
 async findBySeason(seasonId:string):Promise<GroupEntity[]>{return GroupModel.find({seasonRef:new Types.ObjectId(seasonId)}).sort({displayOrder:1,groupName:1}).lean<GroupEntity[]>().exec();}
 async findById(id:string):Promise<GroupEntity|null>{return GroupModel.findById(id).lean<GroupEntity>().exec();}
 async findByName(seasonId:string,name:string):Promise<GroupEntity|null>{return GroupModel.findOne({seasonRef:new Types.ObjectId(seasonId),normalizedGroupName:normalizeGroupName(name)}).lean<GroupEntity>().exec();}
 async create(data:GroupFields):Promise<GroupEntity>{const record=await GroupModel.create({...data,groupName:data.groupName.trim(),normalizedGroupName:normalizeGroupName(data.groupName)});return record.toObject() as GroupEntity;}
 async update(id:string,data:Partial<Pick<GroupFields,"groupName"|"displayOrder">>):Promise<GroupEntity|null>{const patch={...data,...(data.groupName!==undefined?{groupName:data.groupName.trim(),normalizedGroupName:normalizeGroupName(data.groupName)}:{})};return GroupModel.findByIdAndUpdate(id,{$set:patch},{returnDocument:"after",runValidators:true}).lean<GroupEntity>().exec();}
 async delete(id:string):Promise<boolean>{return (await GroupModel.findByIdAndDelete(id).select("_id").lean().exec())!==null;}
}
