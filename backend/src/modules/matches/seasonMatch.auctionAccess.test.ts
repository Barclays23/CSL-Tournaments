import assert from "node:assert/strict";
import test from "node:test";
import { requiresAuctionForFixtureMutation } from "./seasonMatch.auctionAccess.js";

test("fixture creation, schedule, identity and participant changes require completed auction", () => {
  const mutations = [
    { matchNumber: 2 },
    { roundNumber: 3 },
    { stage: "group" as const },
    { groupRef: "507f1f77bcf86cd799439011" },
    { kickoffAt: new Date("2026-12-01T10:00:00.000Z") },
    { venueRef: "507f1f77bcf86cd799439012" },
    { homeSeasonTeamRef: "507f1f77bcf86cd799439013" },
    { awaySeasonTeamRef: "507f1f77bcf86cd799439014" },
    { notes: "Updated fixture note" },
  ];
  for (const mutation of mutations) assert.equal(requiresAuctionForFixtureMutation(mutation), true);
});

test("fixture creation accepts Active seasons only; Upcoming is not a live management state", () => {
  assert.equal(requiresAuctionForFixtureMutation({ status: "live" }), false);
});

test("match status and penalty-shootout operations do not require completed auction", () => {
  assert.equal(requiresAuctionForFixtureMutation({ status: "live" }), false);
  assert.equal(requiresAuctionForFixtureMutation({ penaltyShootout: null }), false);
  assert.equal(requiresAuctionForFixtureMutation({ penaltyShootout: { homeScore: 4, awayScore: 3, kicks: [] } as never }), false);
});
