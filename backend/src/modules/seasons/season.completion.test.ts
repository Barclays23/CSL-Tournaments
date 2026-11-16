import test from "node:test";
import assert from "node:assert/strict";
import { getSeasonCompletionBlockers, type SeasonCompletionSnapshot } from "./season.completion.js";

const home = "507f1f77bcf86cd799439011";
const away = "507f1f77bcf86cd799439012";
const base = (): SeasonCompletionSnapshot => ({
  matches: [{ matchNumber: 1, stage: "group", status: "completed", homeSeasonTeamRef: home, awaySeasonTeamRef: away, winnerSeasonTeamRef: null }],
  seasonTeams: [{ _id: home, status: "active" }, { _id: away, status: "registered" }],
  awards: [
    { awardType: "champions", recipients: [{ recipientType: "season_team", seasonTeamRef: home, playerRef: null }] },
    { awardType: "runner_up", recipients: [{ recipientType: "season_team", seasonTeamRef: away, playerRef: null }] },
  ],
  pendingAuctionLots: 0,
});

test("league season can complete without a Final fixture", () => {
  assert.deepEqual(getSeasonCompletionBlockers(base()), []);
});

test("scheduled, postponed, live and abandoned matches block completion", () => {
  const snapshot = base();
  snapshot.matches.push(
    { matchNumber: 2, stage: "group", status: "scheduled", homeSeasonTeamRef: home, awaySeasonTeamRef: away, winnerSeasonTeamRef: null },
    { matchNumber: 3, stage: "group", status: "postponed", homeSeasonTeamRef: home, awaySeasonTeamRef: away, winnerSeasonTeamRef: null },
    { matchNumber: 4, stage: "group", status: "live", homeSeasonTeamRef: home, awaySeasonTeamRef: away, winnerSeasonTeamRef: null },
    { matchNumber: 5, stage: "group", status: "abandoned", homeSeasonTeamRef: home, awaySeasonTeamRef: away, winnerSeasonTeamRef: null },
  );
  assert.deepEqual(getSeasonCompletionBlockers(snapshot).filter((message) => message.includes("match(es) remaining")), [
    "1 scheduled match(es) remaining", "1 postponed match(es) remaining", "1 live match(es) remaining", "1 abandoned match(es) remaining",
  ]);
});

test("cancelled matches are terminal and do not require a knockout winner", () => {
  const snapshot = base();
  snapshot.matches.push({ matchNumber: 2, stage: "final", status: "cancelled", homeSeasonTeamRef: home, awaySeasonTeamRef: away, winnerSeasonTeamRef: null });
  assert.deepEqual(getSeasonCompletionBlockers(snapshot), []);
});

test("completed knockout matches require a winner who participated", () => {
  const snapshot = base();
  snapshot.matches.push({ matchNumber: 2, stage: "semi_final", status: "completed", homeSeasonTeamRef: home, awaySeasonTeamRef: away, winnerSeasonTeamRef: null });
  assert.ok(getSeasonCompletionBlockers(snapshot).some((message) => message.includes("completed knockout match")));
  snapshot.matches[1].winnerSeasonTeamRef = "507f1f77bcf86cd799439013";
  assert.ok(getSeasonCompletionBlockers(snapshot).some((message) => message.includes("completed knockout match")));
  snapshot.matches[1].winnerSeasonTeamRef = home;
  assert.ok(!getSeasonCompletionBlockers(snapshot).some((message) => message.includes("completed knockout match")));
});

test("champion and runner-up are mandatory and must differ", () => {
  const snapshot = base();
  snapshot.awards[1].recipients[0].seasonTeamRef = home;
  assert.ok(getSeasonCompletionBlockers(snapshot).some((message) => message.includes("different participating teams")));
  snapshot.awards = snapshot.awards.slice(0, 1);
  assert.ok(getSeasonCompletionBlockers(snapshot).some((message) => message.startsWith("Runner-up not assigned")));
});

test("optional player awards are not required and pending auction lots are blockers", () => {
  const snapshot = base();
  snapshot.awards.push({ awardType: "golden_boot", recipients: [] });
  assert.deepEqual(getSeasonCompletionBlockers(snapshot), []);
  snapshot.pendingAuctionLots = 3;
  assert.deepEqual(getSeasonCompletionBlockers(snapshot), ["3 pending auction lot(s) remain"]);
});

test("withdrawn teams cannot be selected as champion or runner-up", () => {
  const snapshot = base();
  snapshot.seasonTeams[0].status = "withdrawn";
  assert.ok(getSeasonCompletionBlockers(snapshot).some((message) => message.startsWith("Champion not assigned")));
});
