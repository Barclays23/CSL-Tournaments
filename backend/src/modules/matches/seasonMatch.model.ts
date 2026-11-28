import { Schema, model } from "mongoose";
import type { SeasonMatchFields, SeasonGoalFields, SeasonMatchCardFields, MatchClock } from "./seasonMatch.types.js";

const eventTimingFields = {period:{type:String,enum:["first_half","second_half","extra_time_first_half","extra_time_second_half"],default:null},minute:{type:Number,default:null,min:1,validate:{validator:(v:number|null)=>v===null||Number.isInteger(v)}},addedMinutes:{type:Number,default:0,min:0,validate:{validator:(v:number|null)=>v===null||Number.isInteger(v)}}};
const goalSchema = new Schema<SeasonGoalFields>({
  scoringSeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", required: true },
  scorerPlayerRef: { type: Schema.Types.ObjectId, ref: "Player", default: null },
  playerSeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", default: null },
  goalType: { type: String, enum: ["normal", "own_goal"], required: true },
  ...eventTimingFields,
}, { timestamps: { createdAt: true, updatedAt: false } });

const cardSchema = new Schema<SeasonMatchCardFields>({
  seasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", required: true },
  playerRef: { type: Schema.Types.ObjectId, ref: "Player", required: true },
  cardType: { type: String, enum: ["yellow_card", "red_card", "second_yellow"], required: true },
  ...eventTimingFields,
}, { timestamps: { createdAt: true, updatedAt: false } });

const kickSchema = new Schema({
  seasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", required: true },
  playerRef: { type: Schema.Types.ObjectId, ref: "Player", default: null },
  result: { type: String, enum: ["scored", "missed", "saved"], required: true },
}, { _id: false });

const shootoutSchema = new Schema({
  status: { type: String, enum: ["pending", "completed"], required: true },
  homeTeamScore: { type: Number, min: 0, required: true },
  awayTeamScore: { type: Number, min: 0, required: true },
  kicks: { type: [kickSchema], default: [] },
}, { _id: false });

const statusHistorySchema = new Schema({
  fromStatus: { type: String, enum: ["scheduled", "live", "completed", "postponed", "cancelled", "abandoned"], required: true },
  toStatus: { type: String, enum: ["scheduled", "live", "completed", "postponed", "cancelled", "abandoned"], required: true },
  reason: { type: String, default: null, trim: true, maxlength: 500 },
  changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  changedAt: { type: Date, required: true },
  fromKickoffAt: { type: Date, default: null },
  toKickoffAt: { type: Date, default: null },
}, { _id: false, timestamps: false });

const correctionResultSchema = new Schema({
  homeScore: { type: Number, min: 0, required: true },
  awayScore: { type: Number, min: 0, required: true },
  goals: { type: [goalSchema], default: [] },
  cards: { type: [cardSchema], default: [] },
  penaltyShootout: { type: shootoutSchema, default: null },
  winnerSeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", default: null },
}, { _id: false, timestamps: false });
const correctionHistorySchema = new Schema({
  reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 1000 },
  correctedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  correctedAt: { type: Date, required: true },
  originalResult: { type: correctionResultSchema, required: true },
  correctedResult: { type: correctionResultSchema, required: true },
}, { _id: false, timestamps: false });
const resolutionSchema = new Schema({
  status: { type: String, enum: ["cancelled", "abandoned"], required: true },
  reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
  decidedAt: { type: Date, required: true },
}, { _id: false, timestamps: false });

const extraTimeRuleSchema=new Schema({isAllowed:{type:Boolean,required:true},durationMinutes:{type:Number,required:true,validate:{validator:(v:number)=>Number.isInteger(v)&&v>0&&v%2===0}}},{_id:false});
const decidingRulesSchema=new Schema({extraTime:{type:extraTimeRuleSchema,required:true},penaltyShootout:{type:new Schema({isAllowed:{type:Boolean,required:true}},{_id:false}),required:true}},{_id:false});
const clockSchema=new Schema<MatchClock>({isRunning:{type:Boolean,required:true,default:false},clockStartedAt:{type:Date,default:null},periodElapsedSecondsByPeriod:{type:new Schema({firstHalf:{type:Number,default:0,min:0,validate:Number.isInteger},secondHalf:{type:Number,default:0,min:0,validate:Number.isInteger},extraTimeFirstHalf:{type:Number,default:0,min:0,validate:Number.isInteger},extraTimeSecondHalf:{type:Number,default:0,min:0,validate:Number.isInteger}},{_id:false}),required:true,default:()=>({})}},{_id:false});
const auditSnapshotSchema=new Schema({
 status:{type:String,enum:["scheduled","live","completed","postponed","cancelled","abandoned"],default:undefined},
 phase:{type:String,enum:["first_half","half_time","second_half","regular_full_time","extra_time_first_half","extra_time_half_time","extra_time_second_half","extra_time_completed","penalty_shootout","penalty_shootout_completed","full_time"],default:undefined},
 actualStartedAt:{type:Date,default:undefined},
 clock:{type:clockSchema,default:undefined},
 decidingRules:{type:decidingRulesSchema,default:undefined},
 kickoffAt:{type:Date,default:undefined},
 winnerSeasonTeamRef:{type:Schema.Types.ObjectId,ref:"SeasonTeam",default:undefined},
 penaltyShootout:{type:shootoutSchema,default:undefined},
 score:{type:new Schema({homeScore:{type:Number,required:true},awayScore:{type:Number,required:true}},{_id:false}),default:undefined},
},{_id:false,strict:true});
const auditHistorySchema=new Schema({
 action:{type:String,enum:["start_match","pause_clock","resume_clock","phase_transition","phase_correction","status_change","deciding_rules_change","actual_kickoff_correction","clock_correction","shootout_update","completed_match_correction"],required:true},
 actor:{type:Schema.Types.ObjectId,ref:"User",required:true},
 timestamp:{type:Date,required:true},
 previousValue:{type:auditSnapshotSchema,required:true},
 newValue:{type:auditSnapshotSchema,required:true},
 reason:{type:String,default:null,trim:true,maxlength:1000},
},{_id:false,timestamps:false});
const eventAuditValueSchema = new Schema({
  eventType: { type: String, enum: ["goal", "card"], required: true },
  eventId: { type: Schema.Types.ObjectId, required: true },
  scoringSeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", default: undefined },
  scorerPlayerRef: { type: Schema.Types.ObjectId, ref: "Player", default: undefined },
  playerSeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", default: undefined },
  goalType: { type: String, enum: ["normal", "own_goal"], default: undefined },
  seasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", default: undefined },
  playerRef: { type: Schema.Types.ObjectId, ref: "Player", default: undefined },
  cardType: { type: String, enum: ["yellow_card", "red_card", "second_yellow"], default: undefined },
  period: { type: String, enum: ["first_half", "second_half", "extra_time_first_half", "extra_time_second_half"], default: null },
  minute: { type: Number, min: 1, default: null },
  addedMinutes: { type: Number, min: 0, default: 0 },
  createdAt: { type: Date, default: null },
}, { _id: false, strict: true });
const eventAuditHistorySchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, required: true },
  eventType: { type: String, enum: ["goal", "card"], required: true },
  operation: { type: String, enum: ["created", "updated", "deleted"], required: true },
  actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
  timestamp: { type: Date, required: true },
  previousValue: { type: eventAuditValueSchema, default: null },
  newValue: { type: eventAuditValueSchema, default: null },
  reason: { type: String, default: null, trim: true, maxlength: 1000 },
}, { _id: false, timestamps: false });

const schema = new Schema<SeasonMatchFields>({
  seasonRef: { type: Schema.Types.ObjectId, ref: "Season", required: true, immutable: true },
  matchNumber: { type: Number, required: true, min: 1 },
  roundNumber: { type: Number, required: true, min: 1, max: 50 },
  stage: { type: String, enum: ["group", "round_of_16", "quarter_final", "semi_final", "third_place", "final"], required: true },
  groupRef: { type: Schema.Types.ObjectId, ref: "Group", default: null },
  kickoffAt: { type: Date, required: true },
  venueRef: { type: Schema.Types.ObjectId, ref: "Venue", required: true },
  homeSeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", required: true },
  awaySeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", required: true },
  status: { type: String, enum: ["scheduled", "live", "completed", "postponed", "cancelled", "abandoned"], default: "scheduled" },
  matchDurationMinutes:{type:Number,required:true,validate:{validator:(v:number)=>Number.isInteger(v)&&v>=10&&v<=120&&v%2===0}},
  decidingRules:{type:decidingRulesSchema,required:true},actualStartedAt:{type:Date,default:null},
  phase:{type:String,enum:["first_half","half_time","second_half","regular_full_time","extra_time_first_half","extra_time_half_time","extra_time_second_half","extra_time_completed","penalty_shootout","penalty_shootout_completed","full_time"],default:null},
  clock:{type:clockSchema as Schema<MatchClock>,required:true,default:()=>({isRunning:false,clockStartedAt:null,periodElapsedSecondsByPeriod:{firstHalf:0,secondHalf:0,extraTimeFirstHalf:0,extraTimeSecondHalf:0}})},
  goals: { type: [goalSchema], default: [] },
  cards: { type: [cardSchema], default: [] },
  penaltyShootout: { type: shootoutSchema, default: null },
  winnerSeasonTeamRef: { type: Schema.Types.ObjectId, ref: "SeasonTeam", default: null },
  notes: { type: String, default: null, trim: true },
  resolutionHistory: { type: [resolutionSchema], default: [] },
  statusHistory: { type: [statusHistorySchema], default: [] },
  correctionHistory: { type: [correctionHistorySchema], default: [] },
  auditHistory: { type: [auditHistorySchema], default: [] },
  eventAuditHistory: { type: [eventAuditHistorySchema], default: [] },
}, { timestamps: true, versionKey: false });

// Group-stage deciding-rule restrictions are enforced in Zod and the service layer.
schema.index({ seasonRef:  1, matchNumber: 1 }, { unique: true });
schema.index({ seasonRef: 1, kickoffAt: 1 });
schema.index({ seasonRef: 1, stage: 1, groupRef: 1, roundNumber: 1 });
schema.index({ seasonRef: 1, stage: 1, groupRef: 1, homeSeasonTeamRef: 1, awaySeasonTeamRef: 1 });
schema.index({ seasonRef: 1, stage: 1, groupRef: 1, status: 1 });
schema.index({ seasonRef: 1, homeSeasonTeamRef: 1, kickoffAt: -1 });
schema.index({ seasonRef: 1, awaySeasonTeamRef: 1, kickoffAt: -1 });

export const SeasonMatchModel = model<SeasonMatchFields>("SeasonMatch", schema);
