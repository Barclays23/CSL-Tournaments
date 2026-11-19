import test from "node:test";
import assert from "node:assert/strict";
import { getAuctionCompletionBlockers, type AuctionCompletionLot } from "./auction.completion.js";

const settings = { currency: "INR" as const, budgetPerTeam: 1000, playersCount: 20, seasonTeamCount: 4, teamSquadSize: 3, iconPlayerLimit: 1, goalkeeperLimit: 1 };
const teams = [{ _id: "team-a", status: "registered" }, { _id: "team-b", status: "registered" }];
const lot = (team: string, overrides: Partial<AuctionCompletionLot> = {}): AuctionCompletionLot => ({ auctionStatus: "sold", seasonTeamRef: team, purchasePrice: 100, isIconPlayer: false, isGoalkeeper: false, jerseyNo: null, ...overrides });

test("auction completion is blocked while any nominated lot is pending", () => {
  const blockers = getAuctionCompletionBlockers(settings, teams, [lot("team-a"), lot("team-b"), lot("", { auctionStatus: "pending", seasonTeamRef: null })]);
  assert.ok(blockers.some((message) => message.includes("pending auction lot")));
});

test("auction completion requires every eligible team to have a player", () => {
  const blockers = getAuctionCompletionBlockers(settings, teams, [lot("team-a")]);
  assert.ok(blockers.some((message) => message.includes("team-b has no players purchased")));
});

test("auction completion checks squad, icon, goalkeeper and budget limits", () => {
  const blockers = getAuctionCompletionBlockers(settings, teams, [
    lot("team-a", { isIconPlayer: true, isGoalkeeper: true, purchasePrice: 700 }),
    lot("team-a", { isIconPlayer: true, isGoalkeeper: true, purchasePrice: 700 }),
    lot("team-b"),
  ]);
  assert.ok(blockers.some((message) => message.includes("squad size")));
  assert.ok(blockers.some((message) => message.includes("Icon Player limit")));
  assert.ok(blockers.some((message) => message.includes("Goalkeeper limit")));
  assert.ok(blockers.some((message) => message.includes("auction budget")));
});

test("auction completion accepts a resolved and valid roster", () => {
  const blockers = getAuctionCompletionBlockers(settings, teams, [lot("team-a"), lot("team-b"), { ...lot("", { auctionStatus: "unsold", seasonTeamRef: null }), purchasePrice: null }]);
  assert.deepEqual(blockers, []);
});

test("auction completion rejects inconsistent configuration settings", () => {
  const blockers = getAuctionCompletionBlockers({ ...settings, iconPlayerLimit: 4 }, teams, [lot("team-a"), lot("team-b")]);
  assert.ok(blockers.some((message) => message.includes("Icon Player limit")));
});
