import test from "node:test";
import assert from "node:assert/strict";
import { ELIGIBLE_SEASON_TEAM_STATUSES, isAllowedSeasonTransition, isEligibleSeasonTeamStatus, isKickoffWithinSeasonDateWindow, isSeasonReadOnly, isSeasonIdentityEditable, isWinnerOfMatch, normalizeSeasonName } from "./season.rules.js";
import { seasonCreateSchema, seasonUpdateSchema } from "./season.schema.js";
import { normalizeGroupName } from "../groups/group.repository.js";

test("season names normalize spaces and case for global uniqueness", () => {
  assert.equal(normalizeSeasonName("  CSL   Season  10 "), "csl season 10");
});

test("season lifecycle accepts only the specified forward transitions", () => {
  assert.equal(isAllowedSeasonTransition("draft", "upcoming"), true);
  assert.equal(isAllowedSeasonTransition("upcoming", "draft"), true);
  assert.equal(isAllowedSeasonTransition("upcoming", "active"), true);
  assert.equal(isAllowedSeasonTransition("active", "completed"), true);
  assert.equal(isAllowedSeasonTransition("completed", "archived"), true);
  assert.equal(isAllowedSeasonTransition("active", "draft"), false);
  assert.equal(isAllowedSeasonTransition("completed", "active"), false);
  assert.equal(isAllowedSeasonTransition("archived", "draft"), false);
});

test("fixture date validation uses the season timezone and inclusive date bounds", () => {
  const window = {
    startDate: new Date("2026-11-01T00:00:00.000Z"),
    endDate: new Date("2026-11-30T00:00:00.000Z"),
    timeZone: "Asia/Kolkata",
  };
  assert.equal(isKickoffWithinSeasonDateWindow(new Date("2026-10-31T20:00:00.000Z"), window), true);
  assert.equal(isKickoffWithinSeasonDateWindow(new Date("2026-11-30T18:29:00.000Z"), window), true);
  assert.equal(isKickoffWithinSeasonDateWindow(new Date("2026-11-30T18:30:00.000Z"), window), false);
  assert.equal(isKickoffWithinSeasonDateWindow(new Date("2026-10-31T18:29:00.000Z"), window), false);
});


test("normal Season updates cannot mutate lifecycle status", () => {
  assert.equal(seasonUpdateSchema.safeParse({ status: "active" }).success, false);
  assert.equal(seasonUpdateSchema.safeParse({ name: "Renamed Season" }).success, true);
});

test("Season creation rejects duplicate selected Team IDs and invalid date order", () => {
  const valid = {
    seasonNumber: 1,
    name: "CSL Season 1",
    year: 2026,
    startDate: "2026-11-10",
    endDate: "2026-11-20",
    auctionSettings: {
      currency: "INR",
      budgetPerTeam: 10000,
      playersCount: 50,
      seasonTeamCount: 6,
      teamSquadSize: 9,
      iconPlayerLimit: 1,
      goalkeeperLimit: 1,
    },
    teamIds: [],
  };
  assert.equal(seasonCreateSchema.safeParse(valid).success, true);
  assert.equal(seasonCreateSchema.safeParse({ ...valid, seasonNumber: 1000 }).success, true);
  assert.equal(seasonCreateSchema.safeParse({ ...valid, teamIds: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439011"] }).success, false);
  assert.equal(seasonCreateSchema.safeParse({ ...valid, startDate: "2026-11-21", endDate: "2026-11-20" }).success, false);
});


test("only registered and active SeasonTeams qualify for lifecycle readiness", () => {
  assert.deepEqual(ELIGIBLE_SEASON_TEAM_STATUSES, ["registered", "active"]);
  assert.equal(isEligibleSeasonTeamStatus("registered"), true);
  assert.equal(isEligibleSeasonTeamStatus("active"), true);
  assert.equal(isEligibleSeasonTeamStatus("withdrawn"), false);
  assert.equal(isEligibleSeasonTeamStatus("eliminated"), false);
  assert.equal(isEligibleSeasonTeamStatus("completed"), false);
});

test("completed and archived seasons are read-only", () => {
  assert.equal(isSeasonReadOnly("completed"), true);
  assert.equal(isSeasonReadOnly("archived"), true);
  assert.equal(isSeasonReadOnly("draft"), false);
  assert.equal(isSeasonReadOnly("upcoming"), false);
  assert.equal(isSeasonReadOnly("active"), false);
});


test("knockout winner must be one of the fixture participants", () => {
  assert.equal(isWinnerOfMatch("home", "away", "home"), true);
  assert.equal(isWinnerOfMatch("home", "away", "away"), true);
  assert.equal(isWinnerOfMatch("home", "away", null), false);
  assert.equal(isWinnerOfMatch("home", "away", "other"), false);
});

test("group names normalize repeated whitespace and case for season-scoped uniqueness", () => {
  assert.equal(normalizeGroupName("  Group   A  "), "group a");
  assert.equal(normalizeGroupName("GROUP A"), "group a");
  assert.equal(normalizeGroupName("Group\tA"), "group a");
});

test("season identity is editable only for an empty Draft season", () => {
  assert.equal(isSeasonIdentityEditable("draft", false), true);
  assert.equal(isSeasonIdentityEditable("draft", true), false);
  assert.equal(isSeasonIdentityEditable("upcoming", false), false);
  assert.equal(isSeasonIdentityEditable("active", false), false);
  assert.equal(isSeasonIdentityEditable("completed", false), false);
  assert.equal(isSeasonIdentityEditable("archived", false), false);
});
