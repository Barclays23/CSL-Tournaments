import assert from "node:assert/strict";
import test from "node:test";
import { canToggleSeasonTeamManagerAssignment, getSeasonTeamManagerOptions } from "./seasonTeamPermissions.js";

const managers = [
  { _id: "active-free", status: "active" as const },
  { _id: "active-current", status: "active" as const },
  { _id: "inactive-current", status: "inactive" as const },
  { _id: "inactive-free", status: "inactive" as const },
  { _id: "active-other", status: "active" as const },
];

test("manager choices retain current inactive assignments but hide inactive unassigned managers", () => {
  const choices = getSeasonTeamManagerOptions(managers, ["active-current", "inactive-current"], ["active-other"]);
  assert.deepEqual(choices.map((manager) => manager._id), ["active-free", "active-current", "inactive-current"]);
});

test("inactive assigned managers can be removed but cannot be newly assigned", () => {
  assert.equal(canToggleSeasonTeamManagerAssignment("active", "inactive", true), true);
  assert.equal(canToggleSeasonTeamManagerAssignment("active", "inactive", false), false);
  assert.equal(canToggleSeasonTeamManagerAssignment("completed", "active", true), false);
  assert.equal(canToggleSeasonTeamManagerAssignment("active", "active", false), true);
});
