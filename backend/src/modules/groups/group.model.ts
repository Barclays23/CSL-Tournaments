import {Schema,model} from "mongoose";
import type {GroupFields} from "./group.types.js";
const groupSchema=new Schema<GroupFields>({
 seasonRef:{type:Schema.Types.ObjectId,ref:"Season",required:true,immutable:true},
 groupName:{type:String,required:true,trim:true,minlength:1,maxlength:40},
 normalizedGroupName:{type:String,select:false},
 displayOrder:{type:Number,default:0,min:0},
},{timestamps:true,versionKey:false});
groupSchema.index({seasonRef:1,groupName:1},{unique:true});
groupSchema.index({seasonRef:1,normalizedGroupName:1},{unique:true,partialFilterExpression:{normalizedGroupName:{$type:"string"}}});
groupSchema.index({seasonRef:1,displayOrder:1});
export const GroupModel=model<GroupFields>("Group",groupSchema);
