import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { appConfig } from "../config/env.config.js";

type MatchStage = "group" | "round_of_16" | "quarter_final" | "semi_final" | "third_place" | "final";
type MatchStatus = "scheduled" | "live" | "completed" | "postponed" | "cancelled" | "abandoned";
interface LegacyExtraTimeDefaults { isAllowedByDefault?: unknown; defaultDurationMinutes?: unknown; }
interface LegacyPenaltyDefaults { isAllowedByDefault?: unknown; }
interface LegacyMatchRules {
  groupStageDrawAllowed?: unknown;
  defaultMatchDurationMinutes?: unknown;
  extraTime?: LegacyExtraTimeDefaults | null;
  penaltyShootout?: LegacyPenaltyDefaults | null;
  knockoutDrawRequiresShootout?: unknown;
  shootoutCountsForMatchScore?: unknown;
  shootoutCountsForPlayerGoals?: unknown;
}
interface LegacySeasonDocument {
  _id: Types.ObjectId;
  matchRules?: LegacyMatchRules | null;
  updatedAt?: Date;
}
interface LegacyClock {
  isRunning?: unknown;
  clockStartedAt?: Date | null;
  periodElapsedSecondsByPeriod?: {
    firstHalf?: unknown;
    secondHalf?: unknown;
    extraTimeFirstHalf?: unknown;
    extraTimeSecondHalf?: unknown;
  };
}
interface LegacyGoalOrCard {
  period?: string | null;
  minute?: number | null;
  addedMinutes?: number;
}
interface LegacyMatchDocument {
  _id: Types.ObjectId;
  seasonRef: Types.ObjectId;
  status: MatchStatus;
  stage: MatchStage;
  matchDurationMinutes?: unknown;
  decidingRules?: {
    extraTime?: { isAllowed?: unknown; durationMinutes?: unknown };
    penaltyShootout?: { isAllowed?: unknown };
  } | null;
  actualStartedAt?: Date | null;
  phase?: string | null;
  clock?: LegacyClock | null;
  statusHistory?: Array<{ fromStatus?: MatchStatus; toStatus?: MatchStatus }>;
  auditHistory?: Array<{ action?: string }>;
  goals?: LegacyGoalOrCard[];
  cards?: LegacyGoalOrCard[];
  updatedAt?: Date;
}
interface MatchRulesDefaults {
  groupStageDrawAllowed: boolean;
  defaultMatchDurationMinutes: number;
  extraTime: { isAllowedByDefault: boolean; defaultDurationMinutes: number };
  penaltyShootout: { isAllowedByDefault: boolean };
  shootoutCountsForMatchScore: boolean;
  shootoutCountsForPlayerGoals: boolean;
}
interface MatchEngineFieldPatch {
  matchDurationMinutes?: number;
  decidingRules?: {
    extraTime: { isAllowed: boolean; durationMinutes: number };
    penaltyShootout: { isAllowed: boolean };
  };
  actualStartedAt?: Date | null;
  phase?: string | null;
  clock?: {
    isRunning: boolean;
    clockStartedAt: Date | null;
    periodElapsedSecondsByPeriod: { firstHalf: number; secondHalf: number; extraTimeFirstHalf: number; extraTimeSecondHalf: number };
  };
  "goals.$[].period"?: null;
  "goals.$[].minute"?: null;
  "goals.$[].addedMinutes"?: number;
  "cards.$[].period"?: null;
  "cards.$[].minute"?: null;
  "cards.$[].addedMinutes"?: number;
}
interface MigrationReport {
  seasonsExamined: number;
  seasonsNeedingUpdate: number;
  matchesExamined: number;
  matchesNeedingUpdate: number;
  unresolvedSeasons: string[];
  unresolvedMatches: Array<{ id: string; reasons: string[] }>;
  goalsWithoutRecordedTiming: number;
  cardsWithoutRecordedTiming: number;
  updateConflicts: number;
}
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isEvenRegularDuration = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 10 && Number(value) <= 120 && Number(value) % 2 === 0;
const isPositiveEvenDuration = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0 && Number(value) % 2 === 0;
const isNonNegativeWhole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;

function resolveSeasonRules(season: LegacySeasonDocument): MatchRulesDefaults {
  const rules = isPlainObject(season.matchRules) ? season.matchRules as LegacyMatchRules : {};
  const extra = isPlainObject(rules.extraTime) ? rules.extraTime : {};
  const penalty = isPlainObject(rules.penaltyShootout) ? rules.penaltyShootout : {};
  const legacyKnockoutShootout = typeof rules.knockoutDrawRequiresShootout === "boolean"
    ? rules.knockoutDrawRequiresShootout : true;
  return {
    groupStageDrawAllowed: typeof rules.groupStageDrawAllowed === "boolean" ? rules.groupStageDrawAllowed : true,
    defaultMatchDurationMinutes: isEvenRegularDuration(rules.defaultMatchDurationMinutes) ? rules.defaultMatchDurationMinutes : 30,
    extraTime: {
      isAllowedByDefault: typeof extra.isAllowedByDefault === "boolean" ? extra.isAllowedByDefault : false,
      defaultDurationMinutes: isPositiveEvenDuration(extra.defaultDurationMinutes) ? extra.defaultDurationMinutes : 10,
    },
    penaltyShootout: {
      isAllowedByDefault: typeof penalty.isAllowedByDefault === "boolean" ? penalty.isAllowedByDefault : legacyKnockoutShootout,
    },
    shootoutCountsForMatchScore: typeof rules.shootoutCountsForMatchScore === "boolean" ? rules.shootoutCountsForMatchScore : false,
    shootoutCountsForPlayerGoals: typeof rules.shootoutCountsForPlayerGoals === "boolean" ? rules.shootoutCountsForPlayerGoals : false,
  };
}
function seasonRulesNeedPatch(season: LegacySeasonDocument, resolved: MatchRulesDefaults): boolean {
  const rules = isPlainObject(season.matchRules) ? season.matchRules as LegacyMatchRules : {};
  const extra = isPlainObject(rules.extraTime) ? rules.extraTime : {};
  const penalty = isPlainObject(rules.penaltyShootout) ? rules.penaltyShootout : {};
  return !isPlainObject(season.matchRules)
    || typeof rules.groupStageDrawAllowed !== "boolean"
    || !isEvenRegularDuration(rules.defaultMatchDurationMinutes)
    || typeof extra.isAllowedByDefault !== "boolean"
    || !isPositiveEvenDuration(extra.defaultDurationMinutes)
    || typeof penalty.isAllowedByDefault !== "boolean"
    || typeof rules.shootoutCountsForMatchScore !== "boolean"
    || typeof rules.shootoutCountsForPlayerGoals !== "boolean"
    || resolved.defaultMatchDurationMinutes !== rules.defaultMatchDurationMinutes;
}
function isStarted(match: LegacyMatchDocument): boolean {
  const clock = match.clock?.periodElapsedSecondsByPeriod;
  const elapsedExists = [clock?.firstHalf, clock?.secondHalf, clock?.extraTimeFirstHalf, clock?.extraTimeSecondHalf]
    .some((value) => isNonNegativeWhole(value) && value > 0);
  return Boolean(match.actualStartedAt)
    || Boolean(match.phase)
    || elapsedExists
    || (match.goals?.length ?? 0) > 0
    || (match.cards?.length ?? 0) > 0
    || match.status === "live" || match.status === "completed" || match.status === "abandoned"
    || (match.statusHistory ?? []).some((entry) => entry.fromStatus === "live" || entry.toStatus === "live")
    || (match.auditHistory ?? []).some((entry) => entry.action === "start_match");
}
function hasCompleteClock(clock: LegacyClock | null | undefined): boolean {
  if (!clock || typeof clock.isRunning !== "boolean") return false;
  const elapsed = clock.periodElapsedSecondsByPeriod;
  if (!elapsed) return false;
  return isNonNegativeWhole(elapsed.firstHalf)
    && isNonNegativeWhole(elapsed.secondHalf)
    && isNonNegativeWhole(elapsed.extraTimeFirstHalf)
    && isNonNegativeWhole(elapsed.extraTimeSecondHalf)
    && (clock.isRunning ? clock.clockStartedAt instanceof Date : clock.clockStartedAt == null);
}
function matchDecidingRules(match: LegacyMatchDocument, defaults: MatchRulesDefaults) {
  const current = isPlainObject(match.decidingRules) ? match.decidingRules : {};
  const extra = isPlainObject(current.extraTime) ? current.extraTime : {};
  const penalty = isPlainObject(current.penaltyShootout) ? current.penaltyShootout : {};
  return {
    extraTime: {
      isAllowed: match.stage === "group" ? false
        : typeof extra.isAllowed === "boolean" ? extra.isAllowed : defaults.extraTime.isAllowedByDefault,
      durationMinutes: isPositiveEvenDuration(extra.durationMinutes) ? extra.durationMinutes : defaults.extraTime.defaultDurationMinutes,
    },
    penaltyShootout: {
      isAllowed: match.stage === "group" ? false
        : typeof penalty.isAllowed === "boolean" ? penalty.isAllowed : defaults.penaltyShootout.isAllowedByDefault,
    },
  };
}
function matchNeedsDecidingPatch(match: LegacyMatchDocument): boolean {
  if (!isPlainObject(match.decidingRules)) return true;
  const rules = match.decidingRules;
  return !isPlainObject(rules.extraTime)
    || !isPositiveEvenDuration(rules.extraTime.durationMinutes)
    || typeof rules.extraTime.isAllowed !== "boolean"
    || !isPlainObject(rules.penaltyShootout)
    || typeof rules.penaltyShootout.isAllowed !== "boolean"
    || (match.stage === "group" && (rules.extraTime.isAllowed !== false || rules.penaltyShootout.isAllowed !== false));
}
function buildMatchPatch(
  match: LegacyMatchDocument,
  defaults: MatchRulesDefaults,
): { patch: MatchEngineFieldPatch; unresolved: string[] } {
  const patch: MatchEngineFieldPatch = {};
  const unresolved: string[] = [];
  const started = isStarted(match);
  if (match.matchDurationMinutes === undefined || match.matchDurationMinutes === null) {
    patch.matchDurationMinutes = defaults.defaultMatchDurationMinutes;
  } else if (!isEvenRegularDuration(match.matchDurationMinutes)) {
    unresolved.push("invalid existing matchDurationMinutes");
  }
  if (matchNeedsDecidingPatch(match)) patch.decidingRules = matchDecidingRules(match, defaults);

  if (match.actualStartedAt == null) {
    if (started) unresolved.push("started Match has no actualStartedAt; historical kickoff cannot be inferred");
    else if (match.actualStartedAt === undefined) patch.actualStartedAt = null;
  }
  if (match.phase == null) {
    if (started) unresolved.push("started Match has no phase; phase cannot be inferred safely");
    else if (match.phase === undefined) patch.phase = null;
  }
  if (match.goals?.length) {
    if (match.goals.some((goal) => goal.period === undefined)) patch["goals.$[].period"] = null;
    if (match.goals.some((goal) => goal.minute === undefined)) patch["goals.$[].minute"] = null;
    if (match.goals.some((goal) => goal.addedMinutes === undefined)) patch["goals.$[].addedMinutes"] = 0;
  }
  if (match.cards?.length) {
    if (match.cards.some((card) => card.period === undefined)) patch["cards.$[].period"] = null;
    if (match.cards.some((card) => card.minute === undefined)) patch["cards.$[].minute"] = null;
    if (match.cards.some((card) => card.addedMinutes === undefined)) patch["cards.$[].addedMinutes"] = 0;
  }
  if (!match.clock || !hasCompleteClock(match.clock)) {
    if (started) unresolved.push("started Match has incomplete clock data; elapsed seconds cannot be inferred safely");
    else {
      patch.clock = {
        isRunning: false,
        clockStartedAt: null,
        periodElapsedSecondsByPeriod: { firstHalf: 0, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
      };
    }
  }
  return { patch, unresolved };
}

async function migrate(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const report: MigrationReport = {
    seasonsExamined: 0, seasonsNeedingUpdate: 0, matchesExamined: 0, matchesNeedingUpdate: 0,
    unresolvedSeasons: [], unresolvedMatches: [], goalsWithoutRecordedTiming: 0, cardsWithoutRecordedTiming: 0, updateConflicts: 0,
  };
  await mongoose.connect(appConfig.MONGODB_URI);
  try {
    const seasons = mongoose.connection.collection("seasons");
    const matches = mongoose.connection.collection("seasonmatches");
    const seasonRows = await seasons.find({}).toArray() as unknown as LegacySeasonDocument[];
    const seasonDefaults = new Map<string, MatchRulesDefaults>();
    for (const season of seasonRows) {
      report.seasonsExamined += 1;
      const defaults = resolveSeasonRules(season);
      seasonDefaults.set(String(season._id), defaults);
      if (!seasonRulesNeedPatch(season, defaults)) continue;
      report.seasonsNeedingUpdate += 1;
      if (apply) {
        const filter = season.updatedAt ? { _id: season._id, updatedAt: season.updatedAt } : { _id: season._id, updatedAt: { $exists: false } };
        const result = await seasons.updateOne(filter, { $set: { matchRules: defaults } });
        if (result.modifiedCount !== 1) report.updateConflicts += 1;
      }
    }
    const matchRows = await matches.find({}).toArray() as unknown as LegacyMatchDocument[];
    for (const match of matchRows) {
      report.matchesExamined += 1;
      const defaults = seasonDefaults.get(String(match.seasonRef));
      if (!defaults) {
        report.unresolvedMatches.push({ id: String(match._id), reasons: ["referenced Season is missing"] });
        continue;
      }
      for (const goal of match.goals ?? []) {
        if (goal.period == null || goal.minute == null) report.goalsWithoutRecordedTiming += 1;
      }
      for (const card of match.cards ?? []) {
        if (card.period == null || card.minute == null) report.cardsWithoutRecordedTiming += 1;
      }
      const { patch, unresolved } = buildMatchPatch(match, defaults);
      if (unresolved.length) report.unresolvedMatches.push({ id: String(match._id), reasons: unresolved });
      if (!Object.keys(patch).length) continue;
      report.matchesNeedingUpdate += 1;
      if (apply) {
        const filter = match.updatedAt ? { _id: match._id, updatedAt: match.updatedAt } : { _id: match._id, updatedAt: { $exists: false } };
        const result = await matches.updateOne(filter, { $set: patch });
        if (result.modifiedCount !== 1) report.updateConflicts += 1;
      }
    }
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...report }, null, 2));
    if (!apply) console.log("Dry run only. Review unresolved records; rerun with --apply to write only the safe defaults listed above.");
    if (report.unresolvedMatches.length || report.unresolvedSeasons.length || report.updateConflicts) process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
  }
}
migrate().catch((error: unknown) => {
  console.error("Match Engine migration failed", error);
  process.exitCode = 1;
});
