import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import { SeasonMatchService } from "./seasonMatch.service.js";
import { seasonMatchRescheduleSchema } from "./seasonMatch.schema.js";
import type { SeasonMatchRepository } from "./seasonMatch.repository.js";
import type { SeasonMatchEntity, SeasonMatchFields, SeasonMatchStatusHistoryEntry } from "./seasonMatch.types.js";
import type { RescheduleSeasonMatchDto } from "./seasonMatch.dto.js";

const matchId = "507f1f77bcf86cd799439011";
const seasonId = "507f1f77bcf86cd799439012";
const homeId = "507f1f77bcf86cd799439013";
const awayId = "507f1f77bcf86cd799439014";
const groupId = "507f1f77bcf86cd799439015";
const venueId = "507f1f77bcf86cd799439016";
const actorId = "507f1f77bcf86cd799439017";
const originalKickoffAt = new Date("2026-12-10T14:00:00.000Z");
const newKickoffAt = new Date("2027-02-14T15:30:00.000Z");

function createMatch(overrides: Partial<SeasonMatchEntity> = {}): SeasonMatchEntity {
  return {
    _id: new Types.ObjectId(matchId),
    seasonRef: new Types.ObjectId(seasonId),
    matchNumber: 1,
    roundNumber: 1,
    stage: "group",
    groupRef: new Types.ObjectId(groupId),
    kickoffAt: originalKickoffAt,
    venueRef: new Types.ObjectId(venueId),
    homeSeasonTeamRef: new Types.ObjectId(homeId),
    awaySeasonTeamRef: new Types.ObjectId(awayId),
    status: "scheduled",
    goals: [],
    penaltyShootout: null,
    winnerSeasonTeamRef: null,
    notes: null,
    resolutionHistory: [],
    statusHistory: [],
    createdAt: new Date("2026-11-01T10:00:00.000Z"),
    updatedAt: new Date("2026-11-01T10:00:00.000Z"),
    ...overrides,
  };
}

interface Harness {
  service: SeasonMatchService;
  writes: Array<{
    data: Partial<SeasonMatchFields>;
    statusAudit?: { expectedStatus: SeasonMatchFields["status"]; entry: SeasonMatchStatusHistoryEntry };
  }>;
  document: () => SeasonMatchEntity;
}

function makeHarness(
  initial: SeasonMatchEntity = createMatch(),
  seasonOverrides: Record<string, unknown> = {},
): Harness {
  let document = initial;
  const writes: Harness["writes"] = [];
  const season = {
    status: "active",
    auctionLifecycleStatus: "completed",
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
    ...seasonOverrides,
  };
  const homeTeam = {
    _id: new Types.ObjectId(homeId),
    groupRef: new Types.ObjectId(groupId),
    status: "active",
  };
  const awayTeam = {
    _id: new Types.ObjectId(awayId),
    groupRef: new Types.ObjectId(groupId),
    status: "active",
  };

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
    document: () => document,
  };
}

test("Scheduled matches can be postponed with a reason and preserve the original kickoff", async () => {
  const harness = makeHarness(createMatch({ status: "scheduled" }));

  const response = await harness.service.update(
    matchId,
    { status: "postponed", statusReason: "Heavy rain at the venue" },
    actorId,
  );

  assert.equal(harness.document().status, "postponed");
  assert.equal(harness.document().kickoffAt.getTime(), originalKickoffAt.getTime());
  assert.equal(response.statusHistory.length, 1);
  assert.equal(response.statusHistory[0].fromStatus, "scheduled");
  assert.equal(response.statusHistory[0].toStatus, "postponed");
  assert.equal(response.statusHistory[0].reason, "Heavy rain at the venue");
  assert.equal(response.statusHistory[0].fromKickoffAt, originalKickoffAt.toISOString());
  assert.equal(response.statusHistory[0].toKickoffAt, originalKickoffAt.toISOString());
});

test("Live matches can be postponed with a reason and preserve the scheduled kickoff", async () => {
  const harness = makeHarness(createMatch({ status: "live" }));

  const response = await harness.service.update(
    matchId,
    { status: "postponed", statusReason: "Unsafe weather conditions" },
    actorId,
  );

  assert.equal(harness.document().status, "postponed");
  assert.equal(harness.document().kickoffAt.getTime(), originalKickoffAt.getTime());
  assert.equal(response.statusHistory[0].fromStatus, "live");
  assert.equal(response.statusHistory[0].toStatus, "postponed");
  assert.equal(response.statusHistory[0].fromKickoffAt, originalKickoffAt.toISOString());
  assert.equal(response.statusHistory[0].toKickoffAt, originalKickoffAt.toISOString());
});

test("postponement without a reason is rejected without writing status history", async () => {
  const harness = makeHarness(createMatch({ status: "scheduled" }));

  await assert.rejects(
    () => harness.service.update(matchId, { status: "postponed" }, actorId),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "MATCH_STATUS_REASON_REQUIRED",
  );

  assert.equal(harness.writes.length, 0);
  assert.equal(harness.document().status, "scheduled");
  assert.equal(harness.document().statusHistory?.length, 0);
});

test("rescheduling a postponed match updates kickoff and records both old and new times", async () => {
  const previousPostponement: SeasonMatchStatusHistoryEntry = {
    fromStatus: "scheduled",
    toStatus: "postponed",
    reason: "Rain",
    changedBy: new Types.ObjectId(actorId),
    changedAt: new Date("2026-11-20T10:00:00.000Z"),
    fromKickoffAt: originalKickoffAt,
    toKickoffAt: originalKickoffAt,
  };
  const harness = makeHarness(createMatch({
    status: "postponed",
    statusHistory: [previousPostponement],
  }));

  const response = await harness.service.reschedule(
    matchId,
    { kickoffAt: newKickoffAt, reason: "Venue now available" },
    actorId,
  );

  assert.equal(harness.document().status, "scheduled");
  assert.equal(harness.document().kickoffAt.getTime(), newKickoffAt.getTime());
  assert.equal(harness.document().statusHistory?.length, 2);
  const entry = response.statusHistory[1];
  assert.equal(entry.fromStatus, "postponed");
  assert.equal(entry.toStatus, "scheduled");
  assert.equal(entry.reason, "Venue now available");
  assert.equal(entry.changedBy, actorId);
  assert.equal(entry.fromKickoffAt, originalKickoffAt.toISOString());
  assert.equal(entry.toKickoffAt, newKickoffAt.toISOString());
});

test("postponement cannot change the original kickoff in the same generic update", async () => {
  const harness = makeHarness(createMatch({ status: "scheduled" }));

  await assert.rejects(
    () => harness.service.update(
      matchId,
      { status: "postponed", statusReason: "Weather", kickoffAt: newKickoffAt },
      actorId,
    ),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "POSTPONEMENT_KICKOFF_CHANGE_NOT_ALLOWED",
  );

  assert.equal(harness.writes.length, 0);
  assert.equal(harness.document().status, "scheduled");
  assert.equal(harness.document().kickoffAt.getTime(), originalKickoffAt.getTime());
});

test("rescheduling rejects a missing or invalid new kickoff date", async () => {
  const harness = makeHarness(createMatch({ status: "postponed" }));

  await assert.rejects(
    () => harness.service.reschedule(matchId, {} as RescheduleSeasonMatchDto, actorId),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "RESCHEDULE_KICKOFF_REQUIRED",
  );

  assert.equal(harness.writes.length, 0);
  assert.equal(harness.document().status, "postponed");
  assert.equal(harness.document().kickoffAt.getTime(), originalKickoffAt.getTime());
});

test("reschedule request schema requires kickoffAt and accepts a valid date/time", () => {
  assert.equal(seasonMatchRescheduleSchema.safeParse({}).success, false);
  assert.equal(seasonMatchRescheduleSchema.safeParse({ reason: "No date" }).success, false);
  assert.equal(seasonMatchRescheduleSchema.safeParse({ kickoffAt: "not-a-date" }).success, false);
  assert.equal(
    seasonMatchRescheduleSchema.safeParse({ kickoffAt: "2027-02-14T15:30:00.000Z" }).success,
    true,
  );
});

test("rescheduling rejects dates outside the season date window", async () => {
  const harness = makeHarness(
    createMatch({ status: "postponed" }),
    {
      startDate: new Date("2027-01-01T00:00:00.000Z"),
      endDate: new Date("2027-12-31T00:00:00.000Z"),
    },
  );

  await assert.rejects(
    () => harness.service.reschedule(
      matchId,
      { kickoffAt: new Date("2028-02-14T15:30:00.000Z") },
      actorId,
    ),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "FIXTURE_AFTER_SEASON",
  );

  assert.equal(harness.writes.length, 0);
});

test("rescheduling rejects past or unchanged kickoff times", async () => {
  const harness = makeHarness(createMatch({ status: "postponed" }));

  await assert.rejects(
    () => harness.service.reschedule(
      matchId,
      { kickoffAt: new Date("2026-11-17T15:30:00.000Z") },
      actorId,
    ),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "RESCHEDULE_KICKOFF_NOT_FUTURE",
  );

  await assert.rejects(
    () => harness.service.reschedule(
      matchId,
      { kickoffAt: originalKickoffAt },
      actorId,
    ),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "RESCHEDULE_KICKOFF_UNCHANGED",
  );

  assert.equal(harness.writes.length, 0);
  assert.equal(harness.document().status, "postponed");
});

test("generic update cannot reopen a postponed match or alter its kickoff", async () => {
  const harness = makeHarness(createMatch({ status: "postponed" }));

  await assert.rejects(
    () => harness.service.update(matchId, { status: "scheduled", kickoffAt: newKickoffAt }, actorId),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "MATCH_RESCHEDULE_REQUIRED",
  );

  await assert.rejects(
    () => harness.service.update(matchId, { kickoffAt: newKickoffAt }, actorId),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "MATCH_RESCHEDULE_REQUIRED",
  );

  assert.equal(harness.writes.length, 0);
  assert.equal(harness.document().status, "postponed");
});

test("invalid transitions from Postponed remain blocked", async () => {
  const harness = makeHarness(createMatch({ status: "postponed" }));

  await assert.rejects(
    () => harness.service.update(matchId, { status: "live" }, actorId),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "INVALID_MATCH_STATUS_TRANSITION",
  );

  assert.equal(harness.writes.length, 0);
  assert.equal(harness.document().statusHistory?.length, 0);
});

test("rescheduling is allowed only for postponed fixtures", async () => {
  const harness = makeHarness(createMatch({ status: "scheduled" }));

  await assert.rejects(
    () => harness.service.reschedule(matchId, { kickoffAt: newKickoffAt }, actorId),
    (error: unknown) => error instanceof AppError
      && error.errorCode === "MATCH_NOT_POSTPONED",
  );

  assert.equal(harness.writes.length, 0);
});
