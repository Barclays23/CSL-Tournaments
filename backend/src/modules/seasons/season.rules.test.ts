import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedSeasonTransition, isKickoffWithinSeasonDateWindow, normalizeSeasonName } from "./season.rules.js";

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
