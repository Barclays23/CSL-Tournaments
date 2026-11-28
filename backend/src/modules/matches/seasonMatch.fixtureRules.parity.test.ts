import assert from "node:assert/strict";
import test from "node:test";
import { resolveFixtureDecidingRulesForStage } from "./seasonMatch.fixtureRules.js";
import { resolveMockFixtureDecidingRulesForStage } from "../../../frontend/src/mocks/seasonFixtureRules.js";

const defaults = {
  extraTime: { isAllowedByDefault: true, defaultDurationMinutes: 14 },
  penaltyShootout: { isAllowedByDefault: false },
};

test("real and mock fixture conversion rules stay in parity for every deciding-rule combination", () => {
  for (const extraTime of [true, false]) {
    for (const penaltyShootout of [true, false]) {
      const current = {
        extraTime: { isAllowed: extraTime, durationMinutes: 18 },
        penaltyShootout: { isAllowed: penaltyShootout },
      };
      assert.deepEqual(
        resolveMockFixtureDecidingRulesForStage("final", "group", current, defaults),
        resolveFixtureDecidingRulesForStage("final", "group", current, defaults),
      );
      assert.deepEqual(
        resolveMockFixtureDecidingRulesForStage("group", "quarter_final", current, defaults),
        resolveFixtureDecidingRulesForStage("group", "quarter_final", current, defaults),
      );
    }
  }
});

test("real and mock fixture conversions preserve knockout rules when moving between knockout stages", () => {
  const current = {
    extraTime: { isAllowed: false, durationMinutes: 20 },
    penaltyShootout: { isAllowed: true },
  };
  assert.deepEqual(
    resolveMockFixtureDecidingRulesForStage("semi_final", "final", current, defaults),
    resolveFixtureDecidingRulesForStage("semi_final", "final", current, defaults),
  );
});
