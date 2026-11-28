import assert from "node:assert/strict";
import test from "node:test";
import { getLiveMatchConflictingTeamIds, getPairFixtureError, resolveFixtureDecidingRulesForStage, isActiveFixtureVenue } from "./seasonMatch.fixtureRules.js";
const fixture = (roundNumber:number, homeSeasonTeamRef:string, awaySeasonTeamRef:string, _id:string) => ({roundNumber,homeSeasonTeamRef,awaySeasonTeamRef,_id});
test("blocks same pair in same round even when home and away are reversed", () => {
  assert.equal(getPairFixtureError([fixture(1,"A","B","1")],1,"B","A",true),"DUPLICATE_PAIR_IN_ROUND");
});
test("blocks second meeting when home and away is disabled", () => {
  assert.equal(getPairFixtureError([fixture(1,"A","B","1")],2,"B","A",false),"DUPLICATE_TEAM_PAIR");
});
test("allows only reversed home and away return fixture in another round", () => {
  assert.equal(getPairFixtureError([fixture(1,"A","B","1")],2,"B","A",true),null);
  assert.equal(getPairFixtureError([fixture(1,"A","B","1")],2,"A","B",true),"DUPLICATE_HOME_AWAY_ORIENTATION");
});
test("blocks a third meeting in a home and away season", () => {
  assert.equal(getPairFixtureError([fixture(1,"A","B","1"),fixture(2,"B","A","2")],3,"A","B",true),"PAIR_FIXTURE_LIMIT");
});
test("editing ignores the current fixture when validating its pair", () => {
  assert.equal(getPairFixtureError([fixture(1,"A","B","1")],1,"A","B",false,"1"),null);
});

const liveFixture = (homeSeasonTeamRef:string, awaySeasonTeamRef:string, _id:string) => ({homeSeasonTeamRef,awaySeasonTeamRef,_id});

test("live match conflict detection blocks either team from joining another ongoing match", () => {
  const ongoing = [liveFixture("A", "B", "live-1")];

  assert.deepEqual(getLiveMatchConflictingTeamIds(ongoing, "A", "C"), ["A"]);
  assert.deepEqual(getLiveMatchConflictingTeamIds(ongoing, "C", "B"), ["B"]);
  assert.deepEqual(getLiveMatchConflictingTeamIds(ongoing, "C", "D"), []);
});

test("live match conflict detection ignores the fixture being updated", () => {
  const ongoing = [liveFixture("A", "B", "current"), liveFixture("C", "D", "another")];

  assert.deepEqual(getLiveMatchConflictingTeamIds(ongoing, "A", "C", "current"), ["C"]);
  assert.deepEqual(getLiveMatchConflictingTeamIds(ongoing, "A", "B", "current"), []);
});


test("knockout to Group Stage disables all deciding flags and preserves the configured Extra Time duration", () => {
  const combinations = [
    { extraTime: true, penaltyShootout: true },
    { extraTime: true, penaltyShootout: false },
    { extraTime: false, penaltyShootout: true },
    { extraTime: false, penaltyShootout: false },
  ];
  for (const combination of combinations) {
    assert.deepEqual(resolveFixtureDecidingRulesForStage("final", "group", {
      extraTime: { isAllowed: combination.extraTime, durationMinutes: 18 },
      penaltyShootout: { isAllowed: combination.penaltyShootout },
    }, {
      extraTime: { isAllowedByDefault: true, defaultDurationMinutes: 12 },
      penaltyShootout: { isAllowedByDefault: true },
    }), {
      extraTime: { isAllowed: false, durationMinutes: 18 },
      penaltyShootout: { isAllowed: false },
    });
  }
});

test("Group Stage to knockout re-inherits Season defaults", () => {
  assert.deepEqual(resolveFixtureDecidingRulesForStage("group", "quarter_final", {
    extraTime: { isAllowed: false, durationMinutes: 18 },
    penaltyShootout: { isAllowed: false },
  }, {
    extraTime: { isAllowedByDefault: true, defaultDurationMinutes: 14 },
    penaltyShootout: { isAllowedByDefault: false },
  }), {
    extraTime: { isAllowed: true, durationMinutes: 14 },
    penaltyShootout: { isAllowed: false },
  });
});


test("fixture venue selection requires an active Venue for creation and editing", () => {
  assert.equal(isActiveFixtureVenue({ status: "active" }), true);
  assert.equal(isActiveFixtureVenue({ status: "inactive" }), false);
  assert.equal(isActiveFixtureVenue(null), false);
  assert.equal(isActiveFixtureVenue(undefined), false);
});
