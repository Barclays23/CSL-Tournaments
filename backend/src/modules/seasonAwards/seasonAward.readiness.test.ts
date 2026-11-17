import assert from "node:assert/strict";
import test from "node:test";
import { getSeasonAwardReadinessBlockers } from "./seasonAward.readiness.js";

const teamA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const teamB = "bbbbbbbbbbbbbbbbbbbbbbbb";
const cancelledHistory = [{
  status: "cancelled",
  reason: "Cancelled by the tournament committee",
  decidedAt: new Date("2026-11-17T10:00:00.000Z"),
}];

function match(overrides: Partial<Parameters<typeof getSeasonAwardReadinessBlockers>[0]["matches"][number]> = {}) {
  return {
    matchNumber: 1,
    stage: "group",
    status: "completed",
    homeSeasonTeamRef: teamA,
    awaySeasonTeamRef: teamB,
    winnerSeasonTeamRef: null,
    ...overrides,
  };
}

const teams = [teamA, teamB];

test("requires at least one fixture before honours can be assigned", () => {
  assert.ok(getSeasonAwardReadinessBlockers({ matches: [], seasonTeamIds: teams, pendingAuctionLots: 0 }).length);
});

test("blocks live, scheduled, postponed and abandoned fixtures", () => {
  const matches = ["live", "scheduled", "postponed", "abandoned"].map((status, index) =>
    match({ matchNumber: index + 1, status }),
  );
  const blockers = getSeasonAwardReadinessBlockers({ matches, seasonTeamIds: teams, pendingAuctionLots: 0 });
  assert.equal(blockers.length, 4);
});

test("requires audited cancellation reason but accepts valid cancelled fixtures", () => {
  assert.ok(getSeasonAwardReadinessBlockers({
    matches: [match({ status: "cancelled" })], seasonTeamIds: teams, pendingAuctionLots: 0,
  }).some((item) => item.includes("cancelled fixture")));
  assert.deepEqual(getSeasonAwardReadinessBlockers({
    matches: [match({ status: "cancelled", resolutionHistory: cancelledHistory })],
    seasonTeamIds: teams,
    pendingAuctionLots: 0,
  }), []);
});

test("blocks completed knockout fixtures without a valid participant winner", () => {
  const blockers = getSeasonAwardReadinessBlockers({
    matches: [match({ stage: "semi_final" })], seasonTeamIds: teams, pendingAuctionLots: 0,
  });
  assert.ok(blockers.some((item) => item.includes("missing a valid winner")));
});

test("accepts completed knockout fixtures with a participant winner", () => {
  assert.deepEqual(getSeasonAwardReadinessBlockers({
    matches: [match({ stage: "semi_final", winnerSeasonTeamRef: teamA })],
    seasonTeamIds: teams,
    pendingAuctionLots: 0,
  }), []);
});

test("blocks pending auction lots", () => {
  const blockers = getSeasonAwardReadinessBlockers({
    matches: [match()], seasonTeamIds: teams, pendingAuctionLots: 2,
  });
  assert.ok(blockers.some((item) => item.includes("2 pending auction lot(s)")));
});

test("blocks match references to a team outside the selected season", () => {
  const blockers = getSeasonAwardReadinessBlockers({
    matches: [match({ awaySeasonTeamRef: "cccccccccccccccccccccccc" })],
    seasonTeamIds: teams,
    pendingAuctionLots: 0,
  });
  assert.ok(blockers.some((item) => item.includes("cross-season")));
});
