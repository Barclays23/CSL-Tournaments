import assert from "node:assert/strict";
import test from "node:test";
import { assertStageMatchesResolved, groupStageQualifiers, qualifiedTeamsForStage } from "./seasonMatch.qualification.js";

const teams = [
  { _id: "a1", displayName: "Alpha", groupRef: "A", status: "active" },
  { _id: "a2", displayName: "Bravo", groupRef: "A", status: "active" },
  { _id: "a3", displayName: "Charlie", groupRef: "A", status: "active" },
  { _id: "b1", displayName: "Delta", groupRef: "B", status: "active" },
  { _id: "b2", displayName: "Echo", groupRef: "B", status: "active" },
  { _id: "b3", displayName: "Foxtrot", groupRef: "B", status: "withdrawn" },
];
const match = (stage: "group" | "round_of_16" | "quarter_final" | "semi_final", home: string, away: string, winner: string, status = "completed") => ({
  stage, status, homeSeasonTeamRef: home, awaySeasonTeamRef: away,
  goals: [{ scoringSeasonTeamRef: winner }, { scoringSeasonTeamRef: winner }],
  winnerSeasonTeamRef: winner,
});

test("group qualification ranks active teams by points, goal difference and goals scored", () => {
  const matches = [
    match("group", "a1", "a2", "a1"),
    match("group", "a1", "a3", "a1"),
    match("group", "a2", "a3", "a2"),
    match("group", "b1", "b2", "b1"),
  ];
  const qualified = groupStageQualifiers(teams, matches, { win: 3, draw: 1, loss: 0 });
  assert.deepEqual([...qualified].sort(), ["a1", "a2", "b1", "b2"]);
  assert.equal(qualified.has("b3"), false);
});

test("round-of-16 entrants come from group qualifiers", () => {
  const eligible = qualifiedTeamsForStage("round_of_16", new Set(["a1", "a2", "b1", "b2"]), new Set(["x"]), [], [], []);
  assert.deepEqual([...eligible].sort(), ["a1", "a2", "b1", "b2"]);
});

test("quarter-final entrants come from completed round-of-16 winners", () => {
  const eligible = qualifiedTeamsForStage("quarter_final", new Set(), new Set(), [
    match("round_of_16", "a1", "a2", "a1"),
    match("round_of_16", "b1", "b2", "b2"),
  ], [], []);
  assert.deepEqual([...eligible].sort(), ["a1", "b2"]);
});

test("third-place playoff entrants are the semi-final losers", () => {
  const eligible = qualifiedTeamsForStage("third_place", new Set(), new Set(), [], [], [
    match("semi_final", "a1", "b1", "a1"),
    match("semi_final", "a2", "b2", "b2"),
  ]);
  assert.deepEqual([...eligible].sort(), ["a2", "b1"]);
});

test("a stage cannot advance while a previous fixture remains unresolved", () => {
  assert.throws(() => assertStageMatchesResolved([
    match("round_of_16", "a1", "a2", "a1", "scheduled"),
  ], "Round of 16"), /must be completed/);
});
