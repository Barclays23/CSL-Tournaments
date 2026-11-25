
import test from "node:test";
import assert from "node:assert/strict";
import { getAuctionCompletionBlockers, getAuctionNominationQuotaBlockers, getAuctionStartBlockers, type AuctionCompletionLot } from "./auction.completion.js";

const settings = { currency: "INR" as const, budgetPerTeam: 1000, playersCount: 12, seasonTeamCount: 4, teamSquadSize: 3, iconPlayerLimit: 1, goalkeeperLimit: 1 };
const teams = [
  { _id: "team-a", status: "registered", displayName: "Team A" },
  { _id: "team-b", status: "registered", displayName: "Team B" },
  { _id: "team-c", status: "registered", displayName: "Team C" },
  { _id: "team-d", status: "registered", displayName: "Team D" },
];
const lot = (team: string, overrides: Partial<AuctionCompletionLot> = {}): AuctionCompletionLot => ({
  auctionStatus: "sold", seasonTeamRef: team, purchasePrice: 100, isIconPlayer: false,
  isGoalkeeper: false, jerseyNo: null, soldAt: new Date("2026-01-01T00:00:00.000Z"), ...overrides,
});
const validLots = () => teams.flatMap((team) => [lot(String(team._id)), lot(String(team._id)), lot(String(team._id))]);

test("auction start requires exact configured player and team counts", () => {
  assert.deepEqual(getAuctionStartBlockers(settings, teams, 12), []);
  assert.ok(getAuctionStartBlockers(settings, teams, 11).some((message) => message.includes("non-withdrawn")));
  assert.ok(getAuctionStartBlockers(settings, teams.slice(0, 3), 12).some((message) => message.includes("teams")));
  assert.ok(getAuctionStartBlockers({ ...settings, playersCount: 11 }, teams, 11).some((message) => message.includes("playersCount")));
});

test("auction completion accepts exactly full valid team squads", () => {
  assert.deepEqual(getAuctionCompletionBlockers(settings, teams, validLots()), []);
});

test("auction completion blocks pending and unsold current lots", () => {
  const lots = validLots();
  lots[0] = lot("team-a", { auctionStatus: "pending", seasonTeamRef: null, purchasePrice: null });
  lots[1] = lot("team-a", { auctionStatus: "unsold", seasonTeamRef: null, purchasePrice: null });
  const blockers = getAuctionCompletionBlockers(settings, teams, lots);
  assert.ok(blockers.some((message) => message.includes("pending")));
  assert.ok(blockers.some((message) => message.includes("unsold")));
  assert.ok(blockers.some((message) => message.includes("exactly")));
});

test("withdrawn lots are excluded from current count and roster but must retain sale history", () => {
  const lots = validLots();
  lots.push(lot("team-a", { auctionStatus: "withdrawn" }));
  assert.deepEqual(getAuctionCompletionBlockers(settings, teams, lots), []);
  lots[lots.length - 1] = lot("", { auctionStatus: "withdrawn", seasonTeamRef: null, purchasePrice: null, soldAt: null });
  assert.ok(getAuctionCompletionBlockers(settings, teams, lots).some((message) => message.includes("Withdrawn sold players")));
});

test("completion requires exact squad size for every team and enforces limits", () => {
  const lots = validLots().filter((_, index) => index !== 3);
  lots.push(lot("team-a", { isIconPlayer: true, isGoalkeeper: true, purchasePrice: 700 }));
  lots.push(lot("team-a", { isIconPlayer: true, isGoalkeeper: true, purchasePrice: 700 }));
  const blockers = getAuctionCompletionBlockers(settings, teams, lots);
  assert.ok(blockers.some((message) => message.includes("exactly 3 Sold players")));
  assert.ok(blockers.some((message) => message.includes("Icon Player limit")));
  assert.ok(blockers.some((message) => message.includes("Goalkeeper limit")));
  assert.ok(blockers.some((message) => message.includes("auction budget")));
});

test("completion rejects duplicate jersey numbers and invalid configuration", () => {
  const lots = validLots();
  lots[0] = lot("team-a", { jerseyNo: 10 });
  lots[1] = lot("team-a", { jerseyNo: 10 });
  const blockers = getAuctionCompletionBlockers({ ...settings, playersCount: 10 }, teams, lots);
  assert.ok(blockers.some((message) => message.includes("duplicate jersey")));
  assert.ok(blockers.some((message) => message.includes("playersCount")));
});

test("auction completion requires every eligible team to be assigned to a valid season group", () => {
  const groupReadiness = { groupStageEnabled: true, groupIds: ["group-a", "group-b"] };
  const assignedTeams: Array<typeof teams[number] & { groupRef: string | null }> = teams.map((team, index) => ({ ...team, groupRef: index < 2 ? "group-a" : "group-b" }));
  assert.deepEqual(getAuctionCompletionBlockers(settings, assignedTeams, validLots(), groupReadiness), []);

  const unassignedTeams = assignedTeams.map((team) => ({ ...team }));
  unassignedTeams[2].groupRef = null;
  const unassignedBlockers = getAuctionCompletionBlockers(settings, unassignedTeams, validLots(), groupReadiness);
  assert.ok(unassignedBlockers.some((message) => message.includes("Team C") && message.includes("Season Group")));

  const invalidGroupTeams = assignedTeams.map((team) => ({ ...team }));
  invalidGroupTeams[1].groupRef = "group-from-another-season";
  assert.ok(getAuctionCompletionBlockers(settings, invalidGroupTeams, validLots(), groupReadiness)
    .some((message) => message.includes("Team B") && message.includes("Season Group")));
});

test("auction completion skips group assignment validation when the group stage is disabled", () => {
  const noGroups = teams.map((team) => ({ ...team, groupRef: null }));
  assert.deepEqual(getAuctionCompletionBlockers(settings, noGroups, validLots(), { groupStageEnabled: false, groupIds: [] }), []);
});

test("season-wide nomination quotas are based on configured teams and per-team designation limits", () => {

  assert.deepEqual(getAuctionNominationQuotaBlockers(settings, { iconPlayers: 3, goalkeepers: 3 }, { isIconPlayer: true, isGoalkeeper: true }), []);
  const blockers = getAuctionNominationQuotaBlockers(settings, { iconPlayers: 4, goalkeepers: 4 }, { isIconPlayer: true, isGoalkeeper: true });
  assert.equal(blockers.length, 2);
  assert.ok(blockers[0].includes("maximum of 4 Icon Player"));
  assert.ok(blockers[1].includes("maximum of 4 Goalkeeper"));
});

test("season-wide nomination quota permits ordinary players after designation quotas are full", () => {

  assert.deepEqual(getAuctionNominationQuotaBlockers(settings, { iconPlayers: 4, goalkeepers: 4 }, { isIconPlayer: false, isGoalkeeper: false }), []);
});
