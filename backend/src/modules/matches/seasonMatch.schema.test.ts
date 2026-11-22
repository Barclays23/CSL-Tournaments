import assert from "node:assert/strict";
import test from "node:test";
import { seasonMatchCardSchema } from "./seasonMatch.schema.js";

const validCard = {
  seasonTeamRef: "507f1f77bcf86cd799439011",
  playerRef: "507f1f77bcf86cd799439012",
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
