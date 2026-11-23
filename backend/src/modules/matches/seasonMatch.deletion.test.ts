import assert from "node:assert/strict";
import test from "node:test";
import { hasRecordedMatchIncidents } from "./seasonMatch.deletion.js";

test("a match with a recorded goal cannot be deleted", () => {
  assert.equal(hasRecordedMatchIncidents({ goals: [{ _id: "goal-1" }], cards: [] }), true);
});

test("a match with a recorded card cannot be deleted", () => {
  assert.equal(hasRecordedMatchIncidents({ goals: [], cards: [{ _id: "card-1" }] }), true);
});

test("a match with penalty kicks or correction history cannot be deleted", () => {
  assert.equal(hasRecordedMatchIncidents({ penaltyShootout: { kicks: [{ result: "scored" }] } }), true);
  assert.equal(hasRecordedMatchIncidents({ correctionHistory: [{ reason: "Correction" }] }), true);
});

test("a match with no recorded incidents can be deleted", () => {
  assert.equal(hasRecordedMatchIncidents({ goals: [], cards: [], penaltyShootout: null, correctionHistory: [] }), false);
});
