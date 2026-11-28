import type { Types } from "mongoose";

export type MatchStage = "group" | "round_of_16" | "quarter_final" | "semi_final" | "third_place" | "final";
export type MatchStatus = "scheduled" | "live" | "completed" | "postponed" | "cancelled" | "abandoned";
interface LegacyExtraTimeDefaults { isAllowedByDefault?: unknown; defaultDurationMinutes?: unknown; }
interface LegacyPenaltyDefaults { isAllowedByDefault?: unknown; }
interface LegacyMatchRules {
  defaultMatchDurationMinutes?: unknown; extraTime?: LegacyExtraTimeDefaults | null; penaltyShootout?: LegacyPenaltyDefaults | null;
  knockoutDrawRequiresShootout?: unknown; shootoutCountsForMatchScore?: unknown; shootoutCountsForPlayerGoals?: unknown;
}
export interface LegacySeasonDocument { _id: Types.ObjectId; matchRules?: LegacyMatchRules | null; updatedAt?: Date; }
interface LegacyClock {
  isRunning?: unknown; clockStartedAt?: Date | null;
  periodElapsedSecondsByPeriod?: { firstHalf?: unknown; secondHalf?: unknown; extraTimeFirstHalf?: unknown; extraTimeSecondHalf?: unknown };
}
export interface LegacyGoalOrCard { period?: string | null; minute?: number | null; addedMinutes?: number | null; [key: string]: unknown; }
export interface LegacyMatchDocument {
  _id: Types.ObjectId; seasonRef: Types.ObjectId; status: MatchStatus; stage: MatchStage; matchDurationMinutes?: unknown;
  decidingRules?: { extraTime?: { isAllowed?: unknown; durationMinutes?: unknown }; penaltyShootout?: { isAllowed?: unknown } } | null;
  actualStartedAt?: Date | null; phase?: string | null; clock?: LegacyClock | null;
  statusHistory?: Array<{ fromStatus?: MatchStatus; toStatus?: MatchStatus }>; auditHistory?: Array<{ action?: string }>;
  goals?: LegacyGoalOrCard[]; cards?: LegacyGoalOrCard[]; updatedAt?: Date;
}
export interface MatchRulesDefaults {
  defaultMatchDurationMinutes: number; extraTime: { isAllowedByDefault: boolean; defaultDurationMinutes: number };
  penaltyShootout: { isAllowedByDefault: boolean }; shootoutCountsForMatchScore: boolean; shootoutCountsForPlayerGoals: boolean;
}
export interface MatchUpdatePlan { set: Record<string, unknown>; arrayFilters: Array<Record<string, unknown>>; unresolved: string[]; goalsWithoutRecordedTiming: number; cardsWithoutRecordedTiming: number; }
export interface MigrationReport {
  seasonsExamined: number; seasonsNeedingUpdate: number; seasonsUpdated: number; matchesExamined: number; matchesNeedingUpdate: number; matchesUpdated: number;
  unresolvedSeasons: string[]; unresolvedMatches: Array<{ id: string; reasons: string[] }>;
  goalsWithoutRecordedTiming: number; cardsWithoutRecordedTiming: number; updateConflicts: number; conflictingSeasons: string[]; conflictingMatches: string[];
}
export interface MigrationCollection<T> {
  find(filter: object): { toArray(): Promise<T[]> };
  updateOne(filter: object, update: { $set: Record<string, unknown> }, options?: { arrayFilters?: Array<Record<string, unknown>> }): Promise<{ matchedCount: number; modifiedCount: number }>;
}
const isPlainObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const isEvenRegularDuration = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 10 && Number(value) <= 120 && Number(value) % 2 === 0;
const isPositiveEvenDuration = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0 && Number(value) % 2 === 0;
const isNonNegativeWhole = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
export function resolveSeasonRules(season: LegacySeasonDocument): MatchRulesDefaults {
  const rules = isPlainObject(season.matchRules) ? season.matchRules as LegacyMatchRules : {};
  const extra = isPlainObject(rules.extraTime) ? rules.extraTime : {};
  const penalty = isPlainObject(rules.penaltyShootout) ? rules.penaltyShootout : {};
  const legacyShootout = typeof rules.knockoutDrawRequiresShootout === "boolean" ? rules.knockoutDrawRequiresShootout : true;
  return {
    defaultMatchDurationMinutes: isEvenRegularDuration(rules.defaultMatchDurationMinutes) ? rules.defaultMatchDurationMinutes : 30,
    extraTime: { isAllowedByDefault: typeof extra.isAllowedByDefault === "boolean" ? extra.isAllowedByDefault : false, defaultDurationMinutes: isPositiveEvenDuration(extra.defaultDurationMinutes) ? extra.defaultDurationMinutes : 10 },
    penaltyShootout: { isAllowedByDefault: typeof penalty.isAllowedByDefault === "boolean" ? penalty.isAllowedByDefault : legacyShootout },
    shootoutCountsForMatchScore: typeof rules.shootoutCountsForMatchScore === "boolean" ? rules.shootoutCountsForMatchScore : false,
    shootoutCountsForPlayerGoals: typeof rules.shootoutCountsForPlayerGoals === "boolean" ? rules.shootoutCountsForPlayerGoals : false,
  };
}
export function buildSeasonPatch(season: LegacySeasonDocument, defaults: MatchRulesDefaults): Record<string, unknown> {
  const rules = isPlainObject(season.matchRules) ? season.matchRules as LegacyMatchRules : {};
  const extra = isPlainObject(rules.extraTime) ? rules.extraTime : {};
  const penalty = isPlainObject(rules.penaltyShootout) ? rules.penaltyShootout : {};
  const patch: Record<string, unknown> = {};
  if (!isEvenRegularDuration(rules.defaultMatchDurationMinutes)) patch["matchRules.defaultMatchDurationMinutes"] = defaults.defaultMatchDurationMinutes;
  if (typeof extra.isAllowedByDefault !== "boolean") patch["matchRules.extraTime.isAllowedByDefault"] = defaults.extraTime.isAllowedByDefault;
  if (!isPositiveEvenDuration(extra.defaultDurationMinutes)) patch["matchRules.extraTime.defaultDurationMinutes"] = defaults.extraTime.defaultDurationMinutes;
  if (typeof penalty.isAllowedByDefault !== "boolean") patch["matchRules.penaltyShootout.isAllowedByDefault"] = defaults.penaltyShootout.isAllowedByDefault;
  if (rules.shootoutCountsForMatchScore !== false) patch["matchRules.shootoutCountsForMatchScore"] = false;
  if (rules.shootoutCountsForPlayerGoals !== false) patch["matchRules.shootoutCountsForPlayerGoals"] = false;
  return patch;
}
export function isStarted(match: LegacyMatchDocument): boolean {
  const clock = match.clock?.periodElapsedSecondsByPeriod;
  const elapsed = [clock?.firstHalf, clock?.secondHalf, clock?.extraTimeFirstHalf, clock?.extraTimeSecondHalf].some(value => isNonNegativeWhole(value) && value > 0);
  return Boolean(match.actualStartedAt) || Boolean(match.phase) || elapsed || (match.goals?.length ?? 0) > 0 || (match.cards?.length ?? 0) > 0
    || match.status === "live" || match.status === "completed" || match.status === "abandoned"
    || (match.statusHistory ?? []).some(entry => entry.fromStatus === "live" || entry.toStatus === "live")
    || (match.auditHistory ?? []).some(entry => entry.action === "start_match");
}
function hasCompleteClock(clock: LegacyClock | null | undefined): boolean {
  if (!clock || typeof clock.isRunning !== "boolean" || !clock.periodElapsedSecondsByPeriod) return false;
  const elapsed = clock.periodElapsedSecondsByPeriod;
  return isNonNegativeWhole(elapsed.firstHalf) && isNonNegativeWhole(elapsed.secondHalf) && isNonNegativeWhole(elapsed.extraTimeFirstHalf)
    && isNonNegativeWhole(elapsed.extraTimeSecondHalf) && (clock.isRunning ? clock.clockStartedAt instanceof Date : clock.clockStartedAt == null);
}
function matchDecidingRules(match: LegacyMatchDocument, defaults: MatchRulesDefaults) {
  const current = isPlainObject(match.decidingRules) ? match.decidingRules : {};
  const extra = isPlainObject(current.extraTime) ? current.extraTime : {};
  const penalty = isPlainObject(current.penaltyShootout) ? current.penaltyShootout : {};
  return {
    extraTime: { isAllowed: match.stage === "group" ? false : typeof extra.isAllowed === "boolean" ? extra.isAllowed : defaults.extraTime.isAllowedByDefault,
      durationMinutes: isPositiveEvenDuration(extra.durationMinutes) ? extra.durationMinutes : defaults.extraTime.defaultDurationMinutes },
    penaltyShootout: { isAllowed: match.stage === "group" ? false : typeof penalty.isAllowed === "boolean" ? penalty.isAllowed : defaults.penaltyShootout.isAllowedByDefault },
  };
}
function matchNeedsDecidingPatch(match: LegacyMatchDocument): boolean {
  if (!isPlainObject(match.decidingRules)) return true;
  const rules = match.decidingRules;
  return !isPlainObject(rules.extraTime) || !isPositiveEvenDuration(rules.extraTime.durationMinutes) || typeof rules.extraTime.isAllowed !== "boolean"
    || !isPlainObject(rules.penaltyShootout) || typeof rules.penaltyShootout.isAllowed !== "boolean"
    || (match.stage === "group" && (rules.extraTime.isAllowed !== false || rules.penaltyShootout.isAllowed !== false));
}
function addMissingArrayField(set: Record<string, unknown>, arrayFilters: Array<Record<string, unknown>>, arrayName: "goals" | "cards",
  alias: string, field: "period" | "minute" | "addedMinutes", value: null | 0, event: LegacyGoalOrCard): void {
  if (event[field] !== undefined) return;
  set[`${arrayName}.$[${alias}].${field}`] = value;
  if (!arrayFilters.some(filter => Object.keys(filter).some(key => key.startsWith(`${alias}.`)))) {
    arrayFilters.push({ [`${alias}.${field}`]: { $exists: false } });
  }
}
export function buildMatchPatch(match: LegacyMatchDocument, defaults: MatchRulesDefaults): MatchUpdatePlan {
  const set: Record<string, unknown> = {};
  const arrayFilters: Array<Record<string, unknown>> = [];
  const unresolved: string[] = [];
  const started = isStarted(match);
  if (match.matchDurationMinutes == null) set.matchDurationMinutes = defaults.defaultMatchDurationMinutes;
  else if (!isEvenRegularDuration(match.matchDurationMinutes)) unresolved.push("invalid existing matchDurationMinutes");
  if (matchNeedsDecidingPatch(match)) set.decidingRules = matchDecidingRules(match, defaults);
  if (match.actualStartedAt == null) {
    if (started) unresolved.push("started Match has no actualStartedAt; historical kickoff cannot be inferred");
    else if (match.actualStartedAt === undefined) set.actualStartedAt = null;
  }
  if (match.phase == null) {
    if (started) unresolved.push("started Match has no phase; phase cannot be inferred safely");
    else if (match.phase === undefined) set.phase = null;
  }
  const goals = match.goals ?? [];
  const cards = match.cards ?? [];
  const goalsWithoutRecordedTiming = goals.filter(goal => goal.period == null || goal.minute == null).length;
  const cardsWithoutRecordedTiming = cards.filter(card => card.period == null || card.minute == null).length;
  if (goalsWithoutRecordedTiming) unresolved.push(`${goalsWithoutRecordedTiming} goal event(s) lack recorded period/minute; historical timing cannot be inferred from createdAt`);
  if (cardsWithoutRecordedTiming) unresolved.push(`${cardsWithoutRecordedTiming} card event(s) lack recorded period/minute; historical timing cannot be inferred from createdAt`);
  goals.forEach(goal => {
    addMissingArrayField(set, arrayFilters, "goals", "goalPeriodMissing", "period", null, goal);
    addMissingArrayField(set, arrayFilters, "goals", "goalMinuteMissing", "minute", null, goal);
    addMissingArrayField(set, arrayFilters, "goals", "goalAddedMinutesMissing", "addedMinutes", 0, goal);
  });
  cards.forEach(card => {
    addMissingArrayField(set, arrayFilters, "cards", "cardPeriodMissing", "period", null, card);
    addMissingArrayField(set, arrayFilters, "cards", "cardMinuteMissing", "minute", null, card);
    addMissingArrayField(set, arrayFilters, "cards", "cardAddedMinutesMissing", "addedMinutes", 0, card);
  });
  if (!match.clock || !hasCompleteClock(match.clock)) {
    if (started) unresolved.push("started Match has incomplete clock data; elapsed seconds cannot be inferred safely");
    else set.clock = { isRunning: false, clockStartedAt: null,
      periodElapsedSecondsByPeriod: { firstHalf: 0, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 } };
  }
  return { set, arrayFilters, unresolved, goalsWithoutRecordedTiming, cardsWithoutRecordedTiming };
}
function optimisticFilter(document: { _id: Types.ObjectId; updatedAt?: Date }): Record<string, unknown> {
  return document.updatedAt ? { _id: document._id, updatedAt: document.updatedAt } : { _id: document._id, updatedAt: { $exists: false } };
}
export async function runMatchEngineMigration(seasons: MigrationCollection<LegacySeasonDocument>, matches: MigrationCollection<LegacyMatchDocument>, apply = false): Promise<MigrationReport> {
  const report: MigrationReport = { seasonsExamined:0,seasonsNeedingUpdate:0,seasonsUpdated:0,matchesExamined:0,matchesNeedingUpdate:0,matchesUpdated:0,
    unresolvedSeasons:[],unresolvedMatches:[],goalsWithoutRecordedTiming:0,cardsWithoutRecordedTiming:0,updateConflicts:0,conflictingSeasons:[],conflictingMatches:[] };
  const seasonRows = await seasons.find({}).toArray();
  const seasonDefaults = new Map<string, MatchRulesDefaults>();
  for (const season of seasonRows) {
    report.seasonsExamined++;
    const defaults = resolveSeasonRules(season);
    seasonDefaults.set(String(season._id), defaults);
    const patch = buildSeasonPatch(season, defaults);
    if (!Object.keys(patch).length) continue;
    report.seasonsNeedingUpdate++;
    if (!apply) continue;
    const result = await seasons.updateOne(optimisticFilter(season), { $set: patch });
    if (result.matchedCount !== 1) { report.updateConflicts++; report.conflictingSeasons.push(String(season._id)); }
    else if (result.modifiedCount === 1) report.seasonsUpdated++;
  }
  const matchRows = await matches.find({}).toArray();
  for (const match of matchRows) {
    report.matchesExamined++;
    const defaults = seasonDefaults.get(String(match.seasonRef));
    if (!defaults) { report.unresolvedMatches.push({ id:String(match._id),reasons:["referenced Season is missing"] }); continue; }
    const plan = buildMatchPatch(match, defaults);
    report.goalsWithoutRecordedTiming += plan.goalsWithoutRecordedTiming;
    report.cardsWithoutRecordedTiming += plan.cardsWithoutRecordedTiming;
    if (plan.unresolved.length) report.unresolvedMatches.push({ id:String(match._id),reasons:plan.unresolved });
    if (!Object.keys(plan.set).length) continue;
    report.matchesNeedingUpdate++;
    if (!apply) continue;
    const options = plan.arrayFilters.length ? { arrayFilters: plan.arrayFilters } : undefined;
    const result = await matches.updateOne(optimisticFilter(match), { $set: plan.set }, options);
    if (result.matchedCount !== 1) { report.updateConflicts++; report.conflictingMatches.push(String(match._id)); }
    else if (result.modifiedCount === 1) report.matchesUpdated++;
  }
  return report;
}
