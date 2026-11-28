import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { buildMatchPatch, resolveSeasonRules, runMatchEngineMigration, type LegacyMatchDocument, type LegacySeasonDocument, type MigrationCollection } from "./migrateMatchEngineFields.logic.js";
const updatedAt = new Date("2026-11-20T08:00:00.000Z");
function makeSeason(): LegacySeasonDocument { return { _id:new Types.ObjectId(),updatedAt,matchRules:{defaultMatchDurationMinutes:30,extraTime:{isAllowedByDefault:false,defaultDurationMinutes:10},penaltyShootout:{isAllowedByDefault:true},shootoutCountsForMatchScore:false,shootoutCountsForPlayerGoals:false} }; }
function makeMatch(season:LegacySeasonDocument,overrides:Partial<LegacyMatchDocument>={}):LegacyMatchDocument {
 return {_id:new Types.ObjectId(),seasonRef:season._id,status:"scheduled",stage:"final",matchDurationMinutes:30,
 decidingRules:{extraTime:{isAllowed:false,durationMinutes:10},penaltyShootout:{isAllowed:true}},actualStartedAt:null,phase:null,
 clock:{isRunning:false,clockStartedAt:null,periodElapsedSecondsByPeriod:{firstHalf:0,secondHalf:0,extraTimeFirstHalf:0,extraTimeSecondHalf:0}},
 goals:[],cards:[],updatedAt,...overrides};
}
function matchesFilter(doc:{_id:Types.ObjectId;updatedAt?:Date},filter:object):boolean {
 const query=filter as Record<string,unknown>;if(String(query._id)!==String(doc._id))return false;
 if(query.updatedAt instanceof Date)return doc.updatedAt?.getTime()===query.updatedAt.getTime();
 if(query.updatedAt&&typeof query.updatedAt==="object"&&"$exists"in query.updatedAt)return doc.updatedAt===undefined;
 return true;
}
function matchesArrayFilter(event:Record<string,unknown>,filter:Record<string,unknown>):boolean {
 return Object.entries(filter).every(([path,expected])=>{const field=path.split(".").at(-1)!;if(expected&&typeof expected==="object"&&"$exists"in expected)return (expected as {$exists:boolean}).$exists?Object.hasOwn(event,field):!Object.hasOwn(event,field);return event[field]===expected;});
}
class MemoryCollection<T extends {_id:Types.ObjectId;updatedAt?:Date}> implements MigrationCollection<T> {
 writes=0;constructor(readonly documents:T[]){}
 find(){return {toArray:async()=>this.documents};}
 async updateOne(filter:object,update:{$set:Record<string,unknown>},options?:{arrayFilters?:Array<Record<string,unknown>>}):Promise<{matchedCount:number;modifiedCount:number}>{
 const doc=this.documents.find(item=>matchesFilter(item,filter));if(!doc)return {matchedCount:0,modifiedCount:0};this.writes++;let changed=false;
 for(const [path,value] of Object.entries(update.$set)){
 const arr=/^(goals|cards)\.\$\[([^\]]+)\]\.([^.]+)$/.exec(path);
 if(arr){const [,arrayName,alias,field]=arr;const events=(doc as unknown as Record<string,unknown>)[arrayName] as Array<Record<string,unknown>>|undefined;
 const filterForAlias=options?.arrayFilters?.find(candidate=>Object.keys(candidate).some(key=>key.startsWith(`${alias}.`)));
 for(const event of events??[])if(filterForAlias&&matchesArrayFilter(event,filterForAlias)&&(!Object.hasOwn(event,field)||event[field]!==value)){event[field]=value;changed=true;}continue;}
 const segments=path.split(".");let target=doc as unknown as Record<string,unknown>;for(const segment of segments.slice(0,-1)){if(!target[segment]||typeof target[segment]!=="object")target[segment]={};target=target[segment] as Record<string,unknown>;}
 const leaf=segments.at(-1)!;if(!Object.hasOwn(target,leaf)||JSON.stringify(target[leaf])!==JSON.stringify(value)){target[leaf]=value;changed=true;}
 }
 return {matchedCount:1,modifiedCount:changed?1:0};
 }
}
function collections(season:LegacySeasonDocument,matches:LegacyMatchDocument[]){return {seasons:new MemoryCollection([season]),matches:new MemoryCollection(matches)};}
test("all goals already timed are untouched",()=>{const s=makeSeason(),m=makeMatch(s,{goals:[{period:"first_half",minute:8,addedMinutes:0},{period:"second_half",minute:42,addedMinutes:3}]});const p=buildMatchPatch(m,resolveSeasonRules(s));assert.equal(Object.keys(p.set).some(k=>k.startsWith("goals.")),false);assert.equal(p.arrayFilters.length,0);assert.equal(p.goalsWithoutRecordedTiming,0);});
test("one missing goal is targeted and valid goals remain intact",()=>{const s=makeSeason(),m=makeMatch(s,{goals:[{period:"first_half",minute:11,addedMinutes:2},{addedMinutes:4}]});const p=buildMatchPatch(m,resolveSeasonRules(s));assert.equal(p.set["goals.$[goalPeriodMissing].period"],null);assert.equal(p.set["goals.$[goalMinuteMissing].minute"],null);assert.deepEqual(p.arrayFilters,[{"goalPeriodMissing.period":{$exists:false}},{"goalMinuteMissing.minute":{$exists:false}}]);assert.equal(p.goalsWithoutRecordedTiming,1);});
test("one card missing timing is targeted independently",()=>{const s=makeSeason(),m=makeMatch(s,{cards:[{period:"first_half",minute:9,addedMinutes:0},{period:"second_half",addedMinutes:1}]});const p=buildMatchPatch(m,resolveSeasonRules(s));assert.equal(p.set["cards.$[cardMinuteMissing].minute"],null);assert.deepEqual(p.arrayFilters,[{"cardMinuteMissing.minute":{$exists:false}}]);assert.equal(p.cardsWithoutRecordedTiming,1);});
test("goals and cards mixed valid/missing fields have separate filters",()=>{const s=makeSeason(),m=makeMatch(s,{goals:[{period:"first_half",minute:4,addedMinutes:0},{minute:55}],cards:[{period:"second_half",minute:48,addedMinutes:2},{period:"first_half"}]});const p=buildMatchPatch(m,resolveSeasonRules(s));assert.ok(Object.keys(p.set).some(k=>k.startsWith("goals.$[")));assert.ok(Object.keys(p.set).some(k=>k.startsWith("cards.$["));assert.ok(p.arrayFilters.some(f=>"goalPeriodMissing.period"in f));assert.ok(p.arrayFilters.some(f=>"cardMinuteMissing.minute"in f));assert.equal(p.goalsWithoutRecordedTiming,1);assert.equal(p.cardsWithoutRecordedTiming,1);});
test("existing added time values are preserved",async()=>{const s=makeSeason(),m=makeMatch(s,{goals:[{period:"first_half",minute:15,addedMinutes:5},{period:"second_half",minute:50}]});const {seasons,matches}=collections(s,[m]);await runMatchEngineMigration(seasons,matches,true);assert.equal(m.goals?.[0].addedMinutes,5);assert.equal(m.goals?.[1].addedMinutes,0);});
test("dry run never writes",async()=>{const s=makeSeason(),m=makeMatch(s,{goals:[{minute:10}]});const {seasons,matches}=collections(s,[m]);const before=JSON.stringify({s,m});const report=await runMatchEngineMigration(seasons,matches);assert.equal(seasons.writes,0);assert.equal(matches.writes,0);assert.equal(JSON.stringify({s,m}),before);assert.equal(report.matchesNeedingUpdate,1);assert.equal(report.matchesUpdated,0);});
test("apply changes only missing fields on affected embedded events",async()=>{const s=makeSeason(),validGoal={period:"first_half",minute:12,addedMinutes:3},missingGoal={addedMinutes:6},validCard={period:"second_half",minute:51,addedMinutes:2},missingCard={period:"first_half"};const m=makeMatch(s,{goals:[validGoal,missingGoal],cards:[validCard,missingCard]});const {seasons,matches}=collections(s,[m]);const report=await runMatchEngineMigration(seasons,matches,true);assert.deepEqual(m.goals?.[0],validGoal);assert.deepEqual(m.goals?.[1],{period:null,minute:null,addedMinutes:6});assert.deepEqual(m.cards?.[0],validCard);assert.deepEqual(m.cards?.[1],{period:"first_half",minute:null,addedMinutes:0});assert.equal(report.matchesUpdated,1);assert.equal(report.updateConflicts,0);});
test("running apply twice is idempotent",async()=>{const s=makeSeason(),m=makeMatch(s,{goals:[{minute:16}]});const {seasons,matches}=collections(s,[m]);const first=await runMatchEngineMigration(seasons,matches,true),snapshot=JSON.stringify(m),second=await runMatchEngineMigration(seasons,matches,true);assert.equal(first.matchesUpdated,1);assert.equal(second.matchesNeedingUpdate,0);assert.equal(second.matchesUpdated,0);assert.equal(second.updateConflicts,0);assert.equal(JSON.stringify(m),snapshot);});
test("started match with insufficient timing remains unresolved and never derives from createdAt",()=>{const s=makeSeason(),m=makeMatch(s,{status:"live",actualStartedAt:undefined,phase:undefined,clock:{isRunning:false,clockStartedAt:null,periodElapsedSecondsByPeriod:{firstHalf:120}},goals:[{addedMinutes:0,createdAt:new Date("2026-11-20T08:14:00.000Z")}]});const p=buildMatchPatch(m,resolveSeasonRules(s));assert.equal(p.set.actualStartedAt,undefined);assert.equal(p.set.phase,undefined);assert.equal(p.set.clock,undefined);assert.equal(p.set["goals.$[goalPeriodMissing].period"],null);assert.equal(p.set["goals.$[goalMinuteMissing].minute"],null);assert.ok(p.unresolved.some(r=>r.includes("historical kickoff")));assert.ok(p.unresolved.some(r=>r.includes("phase cannot be inferred")));assert.ok(p.unresolved.some(r=>r.includes("clock data")));assert.ok(p.unresolved.some(r=>r.includes("createdAt")));});
