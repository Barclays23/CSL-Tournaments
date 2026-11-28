import assert from "node:assert/strict";
import test from "node:test";
import { getMockFixtureGroupReadinessBlockers, hasMockMatchIncidents, resolveMockFixtureDecidingRulesForStage } from "./seasonFixtureRules.js";

test("fixture readiness rejects a participating team without a valid group", () => {
  const blockers = getMockFixtureGroupReadinessBlockers({
    groups: [{ _id: "group-a", groupName: "Group A" }],
    participatingTeams: [
      { groupRef: "group-a" }, { groupRef: "group-a" }, { groupRef: "group-a" },
      { groupRef: "group-a" }, { groupRef: "group-a" }, { groupRef: null },
    ],
  });
  assert.ok(blockers.some((message) => message.includes("1 participating team")));
});

test("fixture readiness accepts all six teams assigned to one group", () => {
  assert.deepEqual(getMockFixtureGroupReadinessBlockers({
    groups: [{ _id: "group-a", groupName: "Group A" }],
    participatingTeams: Array.from({ length: 6 }, () => ({ groupRef: "group-a" })),
  }), []);
});

test("fixture readiness rejects empty or single-team groups", () => {
  const blockers = getMockFixtureGroupReadinessBlockers({
    groups: [{ _id: "group-a", groupName: "Group A" }, { _id: "group-b", groupName: "Group B" }],
    participatingTeams: [{ groupRef: "group-a" }, { groupRef: "group-a" }],
  });
  assert.ok(blockers.some((message) => message.includes("Group B")));
});

test("group assignments are not required when group stage is disabled", () => {
  assert.deepEqual(getMockFixtureGroupReadinessBlockers({
    groupStageEnabled: false,
    groups: [],
    participatingTeams: [{ groupRef: null }, { groupRef: null }],
  }), []);
});

test("recorded goals, cards, shootout kicks and corrections prevent match deletion", () => {
  assert.equal(hasMockMatchIncidents({ goals: [{ _id: "goal" }] }), true);
  assert.equal(hasMockMatchIncidents({ cards: [{ _id: "card" }] }), true);
  assert.equal(hasMockMatchIncidents({ penaltyShootout: { kicks: [{ result: "scored" }] } }), true);
  assert.equal(hasMockMatchIncidents({ correctionHistory: [{ reason: "corrected" }] }), true);
  assert.equal(hasMockMatchIncidents({ goals: [], cards: [], penaltyShootout: null, correctionHistory: [] }), false);
});


test("mock knockout to Group Stage disables both deciding options for all combinations", () => {
  for (const flags of [
    { extraTime: true, penaltyShootout: true },
    { extraTime: true, penaltyShootout: false },
    { extraTime: false, penaltyShootout: true },
    { extraTime: false, penaltyShootout: false },
  ]) {
    assert.deepEqual(resolveMockFixtureDecidingRulesForStage("final", "group", {
      extraTime: { isAllowed: flags.extraTime, durationMinutes: 16 },
      penaltyShootout: { isAllowed: flags.penaltyShootout },
    }, {
      extraTime: { isAllowedByDefault: true, defaultDurationMinutes: 14 },
      penaltyShootout: { isAllowedByDefault: true },
    }), {
      extraTime: { isAllowed: false, durationMinutes: 16 },
      penaltyShootout: { isAllowed: false },
    });
  }
});

test("mock Group Stage to knockout restores Season defaults", () => {
  assert.deepEqual(resolveMockFixtureDecidingRulesForStage("group", "semi_final", {
    extraTime: { isAllowed: false, durationMinutes: 16 },
    penaltyShootout: { isAllowed: false },
  }, {
    extraTime: { isAllowedByDefault: true, defaultDurationMinutes: 12 },
    penaltyShootout: { isAllowedByDefault: false },
  }), {
    extraTime: { isAllowed: true, durationMinutes: 12 },
    penaltyShootout: { isAllowed: false },
  });
});
