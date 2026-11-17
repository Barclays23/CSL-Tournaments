import assert from "node:assert/strict";
import test from "node:test";
import { getSeasonTeamWithdrawalBlockers } from "./seasonTeam.withdrawal.rules.js";

const auditedCancelled = { status: "cancelled" as const, reason: "Cancelled by the tournament committee", decidedAt: new Date("2026-11-17T10:00:00.000Z") };

test("completed fixtures and their history do not block withdrawal", () => {
  assert.deepEqual(getSeasonTeamWithdrawalBlockers("active", [{ matchNumber: 1, status: "completed" }]), []);
});

test("live, scheduled and postponed fixtures block withdrawal", () => {
  const blockers = getSeasonTeamWithdrawalBlockers("active", [
    { matchNumber: 1, status: "live" },
    { matchNumber: 2, status: "scheduled" },
    { matchNumber: 3, status: "postponed" },
  ]);
  assert.equal(blockers.length, 3);
});

test("cancelled and abandoned fixtures require matching audited reasons", () => {
  assert.equal(getSeasonTeamWithdrawalBlockers("active", [{ matchNumber: 1, status: "cancelled" }]).length, 1);
  assert.equal(getSeasonTeamWithdrawalBlockers("active", [{ matchNumber: 2, status: "abandoned", resolutionHistory: [auditedCancelled] }]).length, 1);
  assert.deepEqual(getSeasonTeamWithdrawalBlockers("active", [{ matchNumber: 1, status: "cancelled", resolutionHistory: [auditedCancelled] }]), []);
});

test("only registered and active SeasonTeams are eligible", () => {
  for (const status of ["withdrawn", "eliminated", "completed"] as const) {
    assert.ok(getSeasonTeamWithdrawalBlockers(status, []).length > 0);
  }
});