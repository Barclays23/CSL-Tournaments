import assert from "node:assert/strict";
import test from "node:test";
import { getFixtureGroupReadinessBlockers } from "./seasonMatch.readiness.js";

test("fixture creation is blocked when any participating team has no group", () => {
  const blockers = getFixtureGroupReadinessBlockers(true, {
    groupCount: 1,
    unassignedTeamCount: 1,
    undersizedGroups: [],
    emptyGroups: [],
  });
  assert.deepEqual(blockers, ["1 participating team(s) are not assigned to a valid group"]);
});

test("a single group containing all registered teams is valid", () => {
  assert.deepEqual(getFixtureGroupReadinessBlockers(true, {
    groupCount: 1,
    unassignedTeamCount: 0,
    undersizedGroups: [],
    emptyGroups: [],
  }), []);
});

test("group assignments are not required when group stage is disabled", () => {
  assert.deepEqual(getFixtureGroupReadinessBlockers(false, {
    groupCount: 0,
    unassignedTeamCount: 6,
    undersizedGroups: [],
    emptyGroups: [],
  }), []);
});

test("fixture creation is blocked when a configured group has no participating teams", () => {
  const blockers = getFixtureGroupReadinessBlockers(true, {
    groupCount: 2,
    unassignedTeamCount: 0,
    undersizedGroups: [],
    emptyGroups: ["Group B"],
  });
  assert.ok(blockers[0].includes("Group B"));
});

test("groups with fewer than two teams are not accepted as fixture-ready", () => {
  assert.ok(getFixtureGroupReadinessBlockers(true, {
    groupCount: 2,
    unassignedTeamCount: 0,
    undersizedGroups: ["Group B"],
    emptyGroups: [],
  })[0].includes("Group B"));
});
