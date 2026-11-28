import test from "node:test";
import assert from "node:assert/strict";
import { SeasonService } from "./season.service.js";
import { AppError } from "../../shared/errors/appError.js";

const id = "507f1f77bcf86cd799439011";
function service(overrides: Record<string, unknown> = {}) {
  const repository = {
    deleteIfEmptyDraft: async () => false,
    findById: async () => null,
    updateStatus: async () => null,
    ...overrides,
  };
  return new SeasonService(repository as never, {} as never, {} as never);
}

test("deleting a missing season returns 404, not a dependency conflict", async () => {
  const instance = service({ deleteIfEmptyDraft: async () => false });
  await assert.rejects(instance.delete(id), (error: unknown) =>
    error instanceof AppError && error.statusCode === 404 && error.errorCode === "SEASON_NOT_FOUND");
});

test("deleting a season with dependent records returns 409 and preserves history", async () => {
  const instance = service({ deleteIfEmptyDraft: async () => { throw new Error("SEASON_HAS_DEPENDENCIES"); } });
  await assert.rejects(instance.delete(id), (error: unknown) =>
    error instanceof AppError && error.statusCode === 409 && error.errorCode === "SEASON_HAS_DEPENDENCIES");
});

test("archiving is rejected unless the season is Completed", async () => {
  const instance = service({ findById: async () => ({ _id: id, status: "active" }) });
  await assert.rejects(instance.archive(id), (error: unknown) =>
    error instanceof AppError && error.statusCode === 409 && error.errorCode === "SEASON_ARCHIVE_BLOCKED");
});

test("archived and completed season configuration is read-only", async () => {
  const instance = service({ findById: async () => ({ _id: id, status: "completed" }) });
  await assert.rejects(instance.update(id, { name: "Changed" }), (error: unknown) =>
    error instanceof AppError && error.statusCode === 409 && error.errorCode === "SEASON_READ_ONLY");
});

test("creating a season saves only season configuration; teams are registered separately", async () => {
  const now = new Date("2026-11-18T00:00:00.000Z");
  let received: unknown;
  const instance = service({
    findByNumber: async () => null,
    findByNormalizedName: async () => null,
    createSeason: async (input: unknown) => {
      received = input;
      return {
        _id: id, seasonNumber: 1, name: "Season One", year: 2026,
        startDate: null, endDate: null, timeZone: "Asia/Kolkata",
        groupStageEnabled: true, homeAndAwayFixtures: false,
        status: "draft", historyCompleteness: "not_applicable",
        auctionSettings: { currency: "INR", budgetPerTeam: 10000, playersCount: 50, seasonTeamCount: 6, teamSquadSize: 9, iconPlayerLimit: 1, goalkeeperLimit: 1 },
        pointsRules: { win: 3, draw: 1, loss: 0 },
        standingsTieBreakers: ["points"], matchRules: null,
        createdAt: now, updatedAt: now,
      };
    },
  });
  const result = await instance.create({
    seasonNumber: 1, name: "Season One", year: 2026,
    auctionSettings: { currency: "INR", budgetPerTeam: 10000, playersCount: 50, seasonTeamCount: 6, teamSquadSize: 9, iconPlayerLimit: 1, goalkeeperLimit: 1 },
  });
  assert.equal(result._id, id);
  assert.equal(Object.prototype.hasOwnProperty.call(received, "teamIds"), false);
});

test("Draft season name remains editable after teams and groups are registered", async () => {
  const now = new Date("2026-11-18T00:00:00.000Z");
  const current = {
    _id: id, seasonNumber: 1, name: "Season One", year: 2026,
    startDate: null, endDate: null, timeZone: "Asia/Kolkata" as const,
    groupStageEnabled: true, homeAndAwayFixtures: false, status: "draft" as const,
    historyCompleteness: "not_applicable" as const,
    auctionSettings: { currency: "INR" as const, budgetPerTeam: 10000, playersCount: 50, seasonTeamCount: 6, teamSquadSize: 9, iconPlayerLimit: 1, goalkeeperLimit: 1 },
    pointsRules: { win: 3, draw: 1, loss: 0 }, standingsTieBreakers: ["points" as const],
    matchRules: { groupStageDrawAllowed: true, knockoutDrawRequiresShootout: true, shootoutCountsForMatchScore: false as const, shootoutCountsForPlayerGoals: false as const },
    auctionLifecycleStatus: "not_started" as const, createdAt: now, updatedAt: now,
  };
  const instance = service({
    findById: async () => current,
    countSeasonTeams: async () => 2,
    countGroups: async () => 2,
    countLots: async () => 0,
    countMatches: async () => 0,
    getMaxSoldSquadSize: async () => 0,
    findByNormalizedName: async () => null,
    update: async (_seasonId: string, patch: Record<string, unknown>) => ({ ...current, ...patch }),
  });
  const result = await instance.update(id, { name: "Renamed Season" });
  assert.equal(result.name, "Renamed Season");
  await assert.rejects(() => instance.update(id, { seasonNumber: 2 }), (error: unknown) =>
    error instanceof AppError && error.errorCode === "SEASON_IDENTITY_LOCKED");
});


test("match-related Season settings request the repository's atomic first-fixture lock", async () => {
  const now = new Date("2026-11-18T00:00:00.000Z");
  const current = {
    _id: id, seasonNumber: 1, name: "Season One", year: 2026,
    startDate: null, endDate: null, timeZone: "Asia/Kolkata" as const,
    groupStageEnabled: true, homeAndAwayFixtures: false, status: "upcoming" as const,
    historyCompleteness: "not_applicable" as const,
    auctionSettings: { currency: "INR" as const, budgetPerTeam: 10000, playersCount: 50, seasonTeamCount: 6, teamSquadSize: 9, iconPlayerLimit: 1, goalkeeperLimit: 1 },
    pointsRules: { win: 3, draw: 1, loss: 0 },
    standingsTieBreakers: ["points" as const],
    matchRules: {
      defaultMatchDurationMinutes: 30,
      extraTime: { isAllowedByDefault: false, defaultDurationMinutes: 10 },
      penaltyShootout: { isAllowedByDefault: true },
      shootoutCountsForMatchScore: false as const,
      shootoutCountsForPlayerGoals: false as const,
    },
    auctionLifecycleStatus: "completed" as const,
    createdAt: now, updatedAt: now,
  };
  let updateOptions: unknown;
  const instance = service({
    findById: async () => current,
    countSeasonTeams: async () => 2,
    countGroups: async () => 2,
    countLots: async () => 0,
    countMatches: async () => 0,
    getMaxSoldSquadSize: async () => 0,
    update: async (_seasonId: string, _patch: Record<string, unknown>, options: unknown) => {
      updateOptions = options;
      return current;
    },
  });

  await instance.update(id, { matchRules: { defaultMatchDurationMinutes: 32 } });
  assert.deepEqual(updateOptions, { requireNoFixturesForMatchRules: true });
});

test("activation requires the exact eligible participating team count", async () => {
  const instance = service({
    countEligibleSeasonTeams: async () => 3,
    getGroupReadiness: async () => ({ groupCount: 2, unassignedTeamCount: 0, undersizedGroups: [], emptyGroups: [] }),
  });
  const season = {
    _id: id,
    status: "upcoming",
    auctionLifecycleStatus: "completed",
    auctionSettings: { seasonTeamCount: 4 },
    pointsRules: { win: 3, draw: 1, loss: 0 },
    standingsTieBreakers: ["points"],
    matchRules: { groupStageDrawAllowed: true },
    groupStageEnabled: true,
  };
  await assert.rejects(
    () => (instance as unknown as { validateReadiness: (season: unknown, requireAuctionCompleted: boolean) => Promise<void> }).validateReadiness(season, true),
    (error: unknown) => error instanceof AppError && error.errorCode === "SEASON_TEAM_COUNT_MISMATCH",
  );
});

test("activation requires every participating group to contain at least two eligible teams", async () => {
  const instance = service({
    countEligibleSeasonTeams: async () => 4,
    getGroupReadiness: async () => ({ groupCount: 2, unassignedTeamCount: 0, undersizedGroups: ["Group B"], emptyGroups: [] }),
  });
  const season = {
    _id: id,
    status: "upcoming",
    auctionLifecycleStatus: "completed",
    auctionSettings: { seasonTeamCount: 4 },
    pointsRules: { win: 3, draw: 1, loss: 0 },
    standingsTieBreakers: ["points"],
    matchRules: { groupStageDrawAllowed: true },
    groupStageEnabled: true,
  };
  await assert.rejects(
    () => (instance as unknown as { validateReadiness: (season: unknown, requireAuctionCompleted: boolean) => Promise<void> }).validateReadiness(season, true),
    (error: unknown) => error instanceof AppError && error.errorCode === "SEASON_GROUPS_INCOMPLETE",
  );
});

test("activation requires every participating team to be assigned to a season group", async () => {
  const instance = service({
    countEligibleSeasonTeams: async () => 4,
    getGroupReadiness: async () => ({ groupCount: 2, unassignedTeamCount: 1, undersizedGroups: [], emptyGroups: [] }),
  });
  const season = {
    _id: id,
    status: "upcoming",
    auctionLifecycleStatus: "completed",
    auctionSettings: { seasonTeamCount: 4 },
    pointsRules: { win: 3, draw: 1, loss: 0 },
    standingsTieBreakers: ["points"],
    matchRules: { groupStageDrawAllowed: true },
    groupStageEnabled: true,
  };
  await assert.rejects(
    () => (instance as unknown as { validateReadiness: (season: unknown, requireAuctionCompleted: boolean) => Promise<void> }).validateReadiness(season, true),
    (error: unknown) => error instanceof AppError && error.errorCode === "SEASON_GROUPS_INCOMPLETE",
  );
});


test("Upcoming configuration allows unused groups to remain temporarily", async () => {
  const instance = service({
    countEligibleSeasonTeams: async () => 4,
    getGroupReadiness: async () => ({
      groupCount: 3, unassignedTeamCount: 0, undersizedGroups: [], emptyGroups: ["Group C"],
    }),
  });
  const season = {
    _id: id,
    status: "upcoming",
    auctionLifecycleStatus: "not_started",
    auctionSettings: { seasonTeamCount: 4 },
    pointsRules: { win: 3, draw: 1, loss: 0 },
    standingsTieBreakers: ["points"],
    matchRules: { groupStageDrawAllowed: true },
    groupStageEnabled: true,
  };

  await assert.doesNotReject(
    () => (instance as unknown as { validateReadiness: (season: unknown, requireAuctionCompleted: boolean) => Promise<void> }).validateReadiness(season, false),
  );
});

test("activation asks the admin to remove every unused group manually", async () => {
  const instance = service({
    countEligibleSeasonTeams: async () => 4,
    getGroupReadiness: async () => ({
      groupCount: 3, unassignedTeamCount: 0, undersizedGroups: [], emptyGroups: ["Group C"],
    }),
  });
  const season = {
    _id: id,
    status: "upcoming",
    auctionLifecycleStatus: "completed",
    auctionSettings: { seasonTeamCount: 4 },
    pointsRules: { win: 3, draw: 1, loss: 0 },
    standingsTieBreakers: ["points"],
    matchRules: { groupStageDrawAllowed: true },
    groupStageEnabled: true,
  };

  await assert.rejects(
    () => (instance as unknown as { validateReadiness: (season: unknown, requireAuctionCompleted: boolean) => Promise<void> }).validateReadiness(season, true),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "SEASON_GROUPS_INCOMPLETE"
      && error.fieldErrors?.emptyGroups.includes("Group C") === true,
  );
});


test("Upcoming readiness treats a missing groupStageEnabled flag as enabled and rejects unassigned teams", async () => {
  const instance = service({
    countEligibleSeasonTeams: async () => 4,
    getGroupReadiness: async () => ({ groupCount: 1, unassignedTeamCount: 1, undersizedGroups: [], emptyGroups: [] }),
  });
  const legacySeason = {
    _id: id,
    status: "draft",
    auctionLifecycleStatus: "not_started",
    auctionSettings: { seasonTeamCount: 6 },
    pointsRules: { win: 3, draw: 1, loss: 0 },
    standingsTieBreakers: ["points"],
    matchRules: { groupStageDrawAllowed: true },
  };
  await assert.rejects(
    () => (instance as unknown as { validateReadiness: (season: unknown, requireAuctionCompleted: boolean) => Promise<void> }).validateReadiness(legacySeason, false),
    (error: unknown) => error instanceof AppError && error.errorCode === "SEASON_GROUPS_INCOMPLETE",
  );
});
