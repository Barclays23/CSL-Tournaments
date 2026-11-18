import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import { SeasonMatchService } from "./seasonMatch.service.js";
import type { SeasonMatchRepository } from "./seasonMatch.repository.js";
import type { SeasonMatchEntity, SeasonMatchFields, SeasonMatchStatusHistoryEntry } from "./seasonMatch.types.js";

const matchId = "507f1f77bcf86cd799439011";
const seasonId = "507f1f77bcf86cd799439012";
const homeId = "507f1f77bcf86cd799439013";
const awayId = "507f1f77bcf86cd799439014";
const groupId = "507f1f77bcf86cd799439015";
const venueId = "507f1f77bcf86cd799439016";
const actorId = "507f1f77bcf86cd799439017";
const kickoffAt = new Date("2026-11-18T12:00:00.000Z");
const createdAt = new Date("2026-11-18T10:00:00.000Z");
const updatedAt = new Date("2026-11-18T13:00:00.000Z");

function createMatch(overrides: Partial<SeasonMatchEntity> = {}): SeasonMatchEntity {
  return {
    _id: new Types.ObjectId(matchId),
    seasonRef: new Types.ObjectId(seasonId),
    matchNumber: 1,
    roundNumber: 1,
    stage: "group",
    groupRef: new Types.ObjectId(groupId),
    kickoffAt,
    venueRef: new Types.ObjectId(venueId),
    homeSeasonTeamRef: new Types.ObjectId(homeId),
    awaySeasonTeamRef: new Types.ObjectId(awayId),
    status: "live",
    goals: [],
    penaltyShootout: null,
    winnerSeasonTeamRef: null,
    notes: null,
    resolutionHistory: [],
    statusHistory: [],
    createdAt,
    updatedAt,
    ...overrides,
  };
}

interface RepositoryHarness {
  service: SeasonMatchService;
  writes: Array<{
    data: Partial<SeasonMatchFields>;
    statusAudit?: { expectedStatus: SeasonMatchFields["status"]; entry: SeasonMatchStatusHistoryEntry };
  }>;
  getDocument: () => SeasonMatchEntity;
}

function makeHarness(initial: SeasonMatchEntity = createMatch()): RepositoryHarness {
  let document = initial;
  const writes: RepositoryHarness["writes"] = [];

  const season = {
    status: "active",
    startDate: null,
    endDate: null,
    timeZone: "Asia/Kolkata",
    groupStageEnabled: true,
    homeAndAwayFixtures: false,
    pointsRules: { win: 3, draw: 1, loss: 0 },
    matchRules: {
      groupStageDrawAllowed: true,
      knockoutDrawRequiresShootout: true,
      shootoutCountsForMatchScore: false,
      shootoutCountsForPlayerGoals: false,
    },
  };

  const homeTeam = { _id: new Types.ObjectId(homeId), groupRef: new Types.ObjectId(groupId), status: "active" };
  const awayTeam = { _id: new Types.ObjectId(awayId), groupRef: new Types.ObjectId(groupId), status: "active" };

  const repository = {
    findById: async () => document,
    findSeason: async () => season,
    findSeasonTeam: async (_season: string, id: string) => id === homeId ? homeTeam : awayTeam,
    findGroup: async () => ({ _id: new Types.ObjectId(groupId) }),
    findVenue: async () => ({ _id: new Types.ObjectId(venueId), status: "active" }),
    findByNumber: async () => document,
    update: async (
      _id: string,
      data: Partial<SeasonMatchFields>,
      _homeAndAway: boolean,
      statusAudit?: { expectedStatus: SeasonMatchFields["status"]; entry: SeasonMatchStatusHistoryEntry },
    ) => {
      writes.push({ data, statusAudit });
      document = {
        ...document,
        ...data,
        statusHistory: statusAudit
          ? [...(document.statusHistory ?? []), statusAudit.entry]
          : document.statusHistory,
        updatedAt: new Date(),
      };
      return document;
    },
    findPopulatedById: async () => document,
  };

  return {
    service: new SeasonMatchService(repository as unknown as SeasonMatchRepository),
    writes,
    getDocument: () => document,
  };
}

test("successful status changes store from/to status, reason, authenticated user and timestamp", async () => {
  const harness = makeHarness(createMatch({ status: "live" }));
  const before = Date.now();

  const response = await harness.service.update(
    matchId,
    { status: "postponed", statusReason: "Heavy rain at the venue" },
    actorId,
  );

  const entry = harness.writes[0]?.statusAudit?.entry;
  assert.ok(entry);
  assert.equal(entry.fromStatus, "live");
  assert.equal(entry.toStatus, "postponed");
  assert.equal(entry.reason, "Heavy rain at the venue");
  assert.equal(String(entry.changedBy), actorId);
  assert.ok(entry.changedAt instanceof Date);
  assert.ok(entry.changedAt.getTime() >= before);
  assert.ok(entry.changedAt.getTime() <= Date.now());

  assert.equal(response.statusHistory.length, 1);
  assert.equal(response.statusHistory[0].changedBy, actorId);
  assert.equal(response.statusHistory[0].fromStatus, "live");
  assert.equal(response.statusHistory[0].toStatus, "postponed");
});

test("cancellation and abandonment preserve legacy resolution history and add audit entries", async () => {
  const legacyResolution = {
    status: "cancelled" as const,
    reason: "Legacy cancellation record",
    decidedAt: new Date("2026-10-01T08:00:00.000Z"),
  };
  const harness = makeHarness(createMatch({
    status: "live",
    resolutionHistory: [legacyResolution],
  }));

  const response = await harness.service.update(
    matchId,
    { status: "abandoned", resolutionReason: "Unsafe playing conditions" },
    actorId,
  );

  const saved = harness.getDocument();
  assert.equal(saved.resolutionHistory.length, 2);
  assert.equal(saved.resolutionHistory[0].reason, "Legacy cancellation record");
  assert.equal(saved.resolutionHistory[1].status, "abandoned");
  assert.equal(saved.resolutionHistory[1].reason, "Unsafe playing conditions");
  assert.equal(saved.statusHistory?.length, 1);
  assert.equal(saved.statusHistory?.[0].fromStatus, "live");
  assert.equal(saved.statusHistory?.[0].toStatus, "abandoned");
  assert.equal(saved.statusHistory?.[0].reason, "Unsafe playing conditions");
  assert.equal(response.resolutionHistory.length, 2);
});

test("Postponed, Cancelled and Abandoned status changes require a reason", async () => {
  const cases = [
    { current: "live" as const, next: "postponed" as const },
    { current: "scheduled" as const, next: "cancelled" as const },
    { current: "live" as const, next: "abandoned" as const },
  ];

  for (const item of cases) {
    const harness = makeHarness(createMatch({ status: item.current }));
    await assert.rejects(
      () => harness.service.update(matchId, { status: item.next }, actorId),
      (error: unknown) => error instanceof AppError
        && error.errorCode === "MATCH_STATUS_REASON_REQUIRED",
    );
    assert.equal(harness.writes.length, 0);
    assert.equal(harness.getDocument().statusHistory?.length, 0);
  }
});

test("invalid status transitions do not create history or write the match", async () => {
  const harness = makeHarness(createMatch({ status: "scheduled" }));

  await assert.rejects(
    () => harness.service.update(matchId, { status: "abandoned", statusReason: "Match stopped" }, actorId),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "INVALID_MATCH_STATUS_TRANSITION",
  );

  assert.equal(harness.writes.length, 0);
  assert.equal(harness.getDocument().statusHistory?.length, 0);
});

test("a status change requires an authenticated user ID", async () => {
  const harness = makeHarness(createMatch({ status: "live" }));

  await assert.rejects(
    () => harness.service.update(matchId, { status: "postponed", statusReason: "Weather conditions" }),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "UNAUTHENTICATED",
  );

  assert.equal(harness.writes.length, 0);
});

test("ordinary fixture updates do not create duplicate status-history records", async () => {
  const harness = makeHarness(createMatch({ status: "live" }));

  await harness.service.update(matchId, { notes: "Updated match note" }, actorId);

  assert.equal(harness.writes.length, 1);
  assert.equal(harness.writes[0].statusAudit, undefined);
  assert.equal(harness.getDocument().statusHistory?.length, 0);
});

test("conflicting status reason fields are rejected before any write", async () => {
  const harness = makeHarness(createMatch({ status: "live" }));

  await assert.rejects(
    () => harness.service.update(
      matchId,
      { status: "postponed", statusReason: "Weather", resolutionReason: "Venue unavailable" },
      actorId,
    ),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "CONFLICTING_STATUS_REASONS",
  );

  assert.equal(harness.writes.length, 0);
});

test("status reason cannot be attached to an update that does not change status", async () => {
  const harness = makeHarness(createMatch({ status: "live" }));

  await assert.rejects(
    () => harness.service.update(matchId, { statusReason: "Reason without transition" }, actorId),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "STATUS_REASON_WITHOUT_TRANSITION",
  );

  assert.equal(harness.writes.length, 0);
});
