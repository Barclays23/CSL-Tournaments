import { AppError } from "../../shared/errors/appError.js";
import type { MatchClock, MatchTimedPeriod, SeasonMatchEntity, SeasonMatchFields } from "./seasonMatch.types.js";

export const MATCH_PHASES=["first_half","half_time","second_half","regular_full_time","extra_time_first_half","extra_time_half_time","extra_time_second_half","extra_time_completed","penalty_shootout","penalty_shootout_completed","full_time"] as const;
export const MATCH_PHASE_ACTIONS=["half_time","start_second_half","regular_full_time","start_extra_time","extra_time_half_time","start_extra_time_second_half","end_extra_time","start_penalty_shootout","complete_penalty_shootout"] as const;
export type MatchPhaseAction=typeof MATCH_PHASE_ACTIONS[number];
export interface MatchEventTimingInput{period?:MatchTimedPeriod|null;minute?:number|null;addedMinutes?:number;}
export interface ResolvedMatchEventTiming{period:MatchTimedPeriod;minute:number;addedMinutes:number;}
const PERIODS:readonly MatchTimedPeriod[]=["first_half","second_half","extra_time_first_half","extra_time_second_half"];
const CLOCK_KEY:Record<MatchTimedPeriod,keyof MatchClock["periodElapsedSecondsByPeriod"]>={first_half:"firstHalf",second_half:"secondHalf",extra_time_first_half:"extraTimeFirstHalf",extra_time_second_half:"extraTimeSecondHalf"};
const PERIOD_INDEX:Record<MatchTimedPeriod,number>={first_half:0,second_half:1,extra_time_first_half:2,extra_time_second_half:3};

export function getTimedPeriodForPhase(phase:SeasonMatchFields["phase"]):MatchTimedPeriod|null{
 switch(phase){case"first_half":return"first_half";case"second_half":return"second_half";case"extra_time_first_half":return"extra_time_first_half";case"extra_time_second_half":return"extra_time_second_half";default:return null;}
}
export function getLastAvailablePeriodIndex(match:Pick<SeasonMatchEntity,"phase"|"decidingRules">):number{
 switch(match.phase){
  case"first_half":case"half_time":return 0;
  case"second_half":case"regular_full_time":return 1;
  case"extra_time_first_half":case"extra_time_half_time":return 2;
  case"extra_time_second_half":case"extra_time_completed":return 3;
  case"penalty_shootout":case"penalty_shootout_completed":case"full_time":return match.decidingRules.extraTime.isAllowed?3:1;
  default:return -1;
 }
}
export function getPeriodElapsedSeconds(match:Pick<SeasonMatchEntity,"phase"|"clock">,period:MatchTimedPeriod,now=new Date()):number{
 const stored=match.clock.periodElapsedSecondsByPeriod[CLOCK_KEY[period]]??0;
 if(getTimedPeriodForPhase(match.phase)!==period||!match.clock.isRunning)return stored;
 if(!match.clock.clockStartedAt)throw new AppError("The running match clock has no server start timestamp.",409,"MATCH_CLOCK_INVALID");
 return stored+Math.max(0,Math.floor((now.getTime()-match.clock.clockStartedAt.getTime())/1000));
}
export function getClockElapsedSeconds(match:Pick<SeasonMatchEntity,"phase"|"clock">,now=new Date()):number{
 const period=getTimedPeriodForPhase(match.phase);return period?getPeriodElapsedSeconds(match,period,now):0;
}
export function startTimedPeriodClock(clock:MatchClock,phase:SeasonMatchFields["phase"],serverNow:Date):MatchClock{
 if(!getTimedPeriodForPhase(phase))throw new AppError("The current Match phase does not run a clock.",409,"MATCH_CLOCK_PHASE_INVALID");
 if(clock.isRunning)throw new AppError("The match clock is already running.",409,"MATCH_CLOCK_ALREADY_RUNNING");
 return{...clock,isRunning:true,clockStartedAt:serverNow};
}
export function stopTimedPeriodClock(match:Pick<SeasonMatchEntity,"phase"|"clock">,serverNow:Date):MatchClock{
 const period=getTimedPeriodForPhase(match.phase);
 if(!period)throw new AppError("The current Match phase does not run a clock.",409,"MATCH_CLOCK_PHASE_INVALID");
 if(!match.clock.isRunning||!match.clock.clockStartedAt)throw new AppError("The match clock is not running.",409,"MATCH_CLOCK_NOT_RUNNING");
 return{...match.clock,isRunning:false,clockStartedAt:null,periodElapsedSecondsByPeriod:{...match.clock.periodElapsedSecondsByPeriod,[CLOCK_KEY[period]]:getPeriodElapsedSeconds(match,period,serverNow)}};
}
function periodBaseMinutes(match:Pick<SeasonMatchEntity,"matchDurationMinutes"|"decidingRules">,period:MatchTimedPeriod):number{
 const regular=match.matchDurationMinutes/2,extra=match.decidingRules.extraTime.durationMinutes/2;
 switch(period){case"first_half":return 0;case"second_half":return regular;case"extra_time_first_half":return match.matchDurationMinutes;case"extra_time_second_half":return match.matchDurationMinutes+extra;}
}
function periodLengthMinutes(match:Pick<SeasonMatchEntity,"matchDurationMinutes"|"decidingRules">,period:MatchTimedPeriod):number{return period.startsWith("extra_time_")?match.decidingRules.extraTime.durationMinutes/2:match.matchDurationMinutes/2;}
function defaultMinuteAndAdded(match:SeasonMatchEntity,period:MatchTimedPeriod,elapsedSeconds:number):{minute:number;addedMinutes:number}{
 const base=periodBaseMinutes(match,period),nominal=periodLengthMinutes(match,period)*60,boundary=base+nominal/60;
 if(elapsedSeconds<nominal)return{minute:Math.max(1,base+Math.floor(elapsedSeconds/60)),addedMinutes:0};
 return{minute:boundary,addedMinutes:Math.floor((elapsedSeconds-nominal)/60)};
}
export function resolveMatchEventTiming(match:SeasonMatchEntity,input:MatchEventTimingInput,now=new Date(),existing?:MatchEventTimingInput):ResolvedMatchEventTiming{
 if(match.status!=="live"||!match.actualStartedAt)throw new AppError("Timed goals and cards can only be recorded after a match has started and while it is Live.",409,"MATCH_EVENT_MANAGEMENT_NOT_ALLOWED");
 const maxIndex=getLastAvailablePeriodIndex(match),phasePeriod=getTimedPeriodForPhase(match.phase);
 const period=input.period??existing?.period??phasePeriod??PERIODS[maxIndex];
 if(!period)throw new AppError("Start the match before recording a timed event.",409,"MATCH_PHASE_NOT_STARTED");
 const index=PERIOD_INDEX[period];
 if(index>maxIndex)throw new AppError("An event cannot be assigned to a future Match period.",422,"MATCH_EVENT_FUTURE_PERIOD");
 const elapsedSeconds=getPeriodElapsedSeconds(match,period,now),defaults=defaultMinuteAndAdded(match,period,elapsedSeconds);
 const minute=input.minute??existing?.minute??defaults.minute;
 const addedMinutes=input.addedMinutes??existing?.addedMinutes??(input.minute===undefined?defaults.addedMinutes:0);
 const base=periodBaseMinutes(match,period),boundary=base+periodLengthMinutes(match,period);
 if(!Number.isSafeInteger(minute)||minute<=base||minute>boundary)throw new AppError("Enter a valid cumulative match minute within the selected period.",422,"INVALID_MATCH_EVENT_TIME",{minute:"Minute is outside the selected period"});
 if(!Number.isSafeInteger(addedMinutes)||addedMinutes<0||(addedMinutes>0&&minute!==boundary))throw new AppError("Added minutes are valid only at the nominal end of a period.",422,"INVALID_MATCH_EVENT_ADDED_TIME",{addedMinutes:"Use added minutes only at the period boundary"});
 if((minute-base+addedMinutes)*60>elapsedSeconds)throw new AppError("The event time is later than the current stored Match clock position.",422,"MATCH_EVENT_IN_FUTURE",{minute:"An event cannot be recorded ahead of the match clock"});
 return{period,minute,addedMinutes};
}
export function eventElapsedSeconds(match:Pick<SeasonMatchEntity,"matchDurationMinutes"|"decidingRules">,timing:MatchEventTimingInput):number|null{
 if(!timing.period||timing.minute===undefined||timing.minute===null)return null;
 return(timing.minute-periodBaseMinutes(match,timing.period)+(timing.addedMinutes??0))*60;
}
export function periodOrder(period:MatchTimedPeriod):number{return PERIOD_INDEX[period];}
