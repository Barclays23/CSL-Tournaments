import assert from "node:assert/strict";
import test from "node:test";
import { canAssignSeasonTeamGroups, canAssignSeasonTeamManagers } from "./seasonTeam.assignment.rules.js";

test("manager assignments can be changed until a season is completed", () => {
  for (const status of ["draft", "upcoming", "active"]) {
    assert.equal(canAssignSeasonTeamManagers(status), true, `${status} should allow manager changes`);
  }
  for (const status of ["completed", "archived"]) {
    assert.equal(canAssignSeasonTeamManagers(status), false, `${status} should be read-only`);
  }
});

test("group assignments remain limited to pre-activation seasons without fixtures", () => {
  assert.equal(canAssignSeasonTeamGroups("draft", 0), true);
  assert.equal(canAssignSeasonTeamGroups("upcoming", 0), true);
  assert.equal(canAssignSeasonTeamGroups("draft", 1), false);
  assert.equal(canAssignSeasonTeamGroups("upcoming", 3), false);
  assert.equal(canAssignSeasonTeamGroups("active", 0), false);
  assert.equal(canAssignSeasonTeamGroups("active", 5), false);
  assert.equal(canAssignSeasonTeamGroups("completed", 0), false);
  assert.equal(canAssignSeasonTeamGroups("archived", 0), false);
});
