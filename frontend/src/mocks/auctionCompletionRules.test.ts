import assert from "node:assert/strict";
import test from "node:test";
import { getMockAuctionSetupBlockers } from "./auctionCompletionRules.js";

const teams = [
  { _id: "team-a", displayName: "Team A", groupRef: "group-a" },
  { _id: "team-b", displayName: "Team B", groupRef: "group-a" },
  { _id: "team-c", displayName: "Team C", groupRef: "group-b" },
  { _id: "team-d", displayName: "Team D", groupRef: "group-b" },
];

test("auction setup requires every configured team slot to be filled", () => {
  assert.ok(getMockAuctionSetupBlockers(4, teams.slice(0, 3), true, ["group-a", "group-b"])
    .some((message) => message.includes("season team count")));
});

test("auction setup requires all teams to have a group in the same season", () => {
  assert.deepEqual(getMockAuctionSetupBlockers(4, teams, true, ["group-a", "group-b"]), []);
  const missingGroup = teams.map((team) => ({ ...team }));
  missingGroup[2].groupRef = null;
  assert.ok(getMockAuctionSetupBlockers(4, missingGroup, true, ["group-a", "group-b"])
    .some((message) => message.includes("Team C") && message.includes("Season Group")));
  const invalidGroup = teams.map((team) => ({ ...team }));
  invalidGroup[0].groupRef = "group-from-another-season";
  assert.ok(getMockAuctionSetupBlockers(4, invalidGroup, true, ["group-a", "group-b"])
    .some((message) => message.includes("Team A") && message.includes("Season Group")));
});

test("auction setup does not require groups when group stage is disabled", () => {
  const ungroupedTeams = teams.map((team) => ({ ...team, groupRef: null }));
  assert.deepEqual(getMockAuctionSetupBlockers(4, ungroupedTeams, false, []), []);
});
