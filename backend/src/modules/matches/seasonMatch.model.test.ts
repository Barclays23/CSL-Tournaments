import assert from "node:assert/strict";
import test from "node:test";
import { Schema } from "mongoose";
import { SeasonMatchModel } from "./seasonMatch.model.js";

test("SeasonMatch schema declares card subdocuments and their references", () => {
  const cardsPath = SeasonMatchModel.schema.path("cards") as unknown as {
    schema: Schema;
  } | undefined;

  assert.ok(cardsPath, "cards must be a declared SeasonMatch schema path");
  assert.equal(cardsPath.schema.path("seasonTeamRef").options.ref, "SeasonTeam");
  assert.equal(cardsPath.schema.path("playerRef").options.ref, "Player");
  assert.deepEqual(
    cardsPath.schema.path("cardType").options.enum,
    ["yellow_card", "red_card", "second_yellow"],
  );
});

test("SeasonMatch cards default to an empty array", () => {
  const match = new SeasonMatchModel({
    seasonRef: "507f1f77bcf86cd799439011",
    matchNumber: 1,
    roundNumber: 1,
    stage: "group",
    groupRef: "507f1f77bcf86cd799439012",
    kickoffAt: new Date("2026-11-22T10:00:00.000Z"),
    venueRef: "507f1f77bcf86cd799439013",
    homeSeasonTeamRef: "507f1f77bcf86cd799439014",
    awaySeasonTeamRef: "507f1f77bcf86cd799439015",
  });

  assert.deepEqual(match.cards, []);
});
