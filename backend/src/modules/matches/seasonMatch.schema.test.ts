import assert from "node:assert/strict";
import test from "node:test";
import {
  seasonMatchCardSchema,
  seasonMatchCreateSchema,
  seasonMatchUpdateSchema,
} from "./seasonMatch.schema.js";

const objectId = "507f1f77bcf86cd799439011";
const otherObjectId = "507f1f77bcf86cd799439012";
const thirdObjectId = "507f1f77bcf86cd799439013";

const validFixture = {
  matchNumber: 1,
  roundNumber: 1,
  stage: "group",
  groupRef: objectId,
  kickoffAt: "2026-12-01T10:30:00.000Z",
  venueRef: objectId,
  homeSeasonTeamRef: otherObjectId,
  awaySeasonTeamRef: thirdObjectId,
};

const validCard = {
  seasonTeamRef: objectId,
  playerRef: otherObjectId,
  cardType: "yellow_card",
};

test("match card schema accepts supported card types", () => {
  for (const cardType of ["yellow_card", "red_card", "second_yellow"] as const) {
    assert.equal(seasonMatchCardSchema.safeParse({ ...validCard, cardType }).success, true);
  }
});

test("match card schema rejects invalid references and unsupported card types", () => {
  assert.equal(seasonMatchCardSchema.safeParse({ ...validCard, playerRef: "invalid" }).success, false);
  assert.equal(seasonMatchCardSchema.safeParse({ ...validCard, cardType: "blue_card" }).success, false);
  assert.equal(seasonMatchCardSchema.safeParse({ ...validCard, extra: true }).success, false);
});

test("season match create schema accepts a valid group fixture", () => {
  assert.equal(seasonMatchCreateSchema.safeParse(validFixture).success, true);
});

test("season match create schema rejects missing group and duplicate teams", () => {
  const missingGroup = seasonMatchCreateSchema.safeParse({ ...validFixture, groupRef: null });
  assert.equal(missingGroup.success, false);
  if (!missingGroup.success) {
    assert.ok(missingGroup.error.issues.some((issue) => issue.path[0] === "groupRef"));
  }

  const sameTeams = seasonMatchCreateSchema.safeParse({
    ...validFixture,
    homeSeasonTeamRef: otherObjectId,
    awaySeasonTeamRef: otherObjectId,
  });
  assert.equal(sameTeams.success, false);
  if (!sameTeams.success) {
    assert.ok(sameTeams.error.issues.some((issue) => issue.path[0] === "awaySeasonTeamRef"));
  }
});

test("season match create schema validates identifiers, numbers, dates and strict payloads", () => {
  assert.equal(seasonMatchCreateSchema.safeParse({ ...validFixture, venueRef: "invalid" }).success, false);
  assert.equal(seasonMatchCreateSchema.safeParse({ ...validFixture, matchNumber: 0 }).success, false);
  assert.equal(seasonMatchCreateSchema.safeParse({ ...validFixture, roundNumber: 1.5 }).success, false);
  assert.equal(seasonMatchCreateSchema.safeParse({ ...validFixture, kickoffAt: "not-a-date" }).success, false);
  assert.equal(seasonMatchCreateSchema.safeParse({ ...validFixture, unexpected: true }).success, false);
});

test("season match create schema rejects a group reference for a knockout fixture", () => {
  const result = seasonMatchCreateSchema.safeParse({ ...validFixture, stage: "final" });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.path[0] === "groupRef"));
  }
});

test("season match update schema accepts valid partial updates", () => {
  assert.equal(seasonMatchUpdateSchema.safeParse({ notes: "Updated fixture notes" }).success, true);
  assert.equal(seasonMatchUpdateSchema.safeParse({ venueRef: objectId }).success, true);
});

test("season match update schema rejects empty and inconsistent updates", () => {
  assert.equal(seasonMatchUpdateSchema.safeParse({}).success, false);
  assert.equal(seasonMatchUpdateSchema.safeParse({ stage: "group", groupRef: null }).success, false);
  assert.equal(seasonMatchUpdateSchema.safeParse({ stage: "final", groupRef: objectId }).success, false);
  assert.equal(seasonMatchUpdateSchema.safeParse({
    homeSeasonTeamRef: otherObjectId,
    awaySeasonTeamRef: otherObjectId,
  }).success, false);
});
