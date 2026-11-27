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

test("new match timing fields have safe idle defaults and event timing paths",()=>{
 const match=new SeasonMatchModel({seasonRef:"507f1f77bcf86cd799439011",matchNumber:2,roundNumber:1,stage:"group",groupRef:"507f1f77bcf86cd799439012",kickoffAt:new Date(),venueRef:"507f1f77bcf86cd799439013",homeSeasonTeamRef:"507f1f77bcf86cd799439014",awaySeasonTeamRef:"507f1f77bcf86cd799439015",matchDurationMinutes:30,decidingRules:{extraTime:{isAllowed:false,durationMinutes:10},penaltyShootout:{isAllowed:false}}});
 assert.equal(match.actualStartedAt,null);assert.equal(match.phase,null);assert.equal(match.clock.isRunning,false);assert.equal(match.clock.periodElapsedSecondsByPeriod.firstHalf,0);
 const goalsPath=SeasonMatchModel.schema.path("goals") as unknown as {schema:Schema};assert.ok(goalsPath.schema.path("period"));assert.ok(goalsPath.schema.path("minute"));assert.ok(goalsPath.schema.path("addedMinutes"));
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
