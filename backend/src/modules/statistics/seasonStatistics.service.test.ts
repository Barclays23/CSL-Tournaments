import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { SeasonStatisticsService } from "./seasonStatistics.service.js";
import type { SeasonStatisticsRepository } from "./seasonStatistics.repository.js";

const ids = {
  season: "507f1f77bcf86cd799439011",
  group: "507f1f77bcf86cd799439012",
  homeSeasonTeam: "507f1f77bcf86cd799439013",
  awaySeasonTeam: "507f1f77bcf86cd799439014",
  homeTeam: "507f1f77bcf86cd799439015",
  awayTeam: "507f1f77bcf86cd799439016",
  homePlayer: "507f1f77bcf86cd799439017",
  awayPlayer: "507f1f77bcf86cd799439018",
};

const group = { _id: new Types.ObjectId(ids.group), groupName: "Group A", displayOrder: 1 };
function seasonTeam(id: string, teamId: string, name: string) {
  return {
    _id: new Types.ObjectId(id),
    displayName: name,
    logoSnapshot: null,
    teamRef: { _id: new Types.ObjectId(teamId), name, shortName: name.slice(0, 3), logo: null },
    groupRef: group,
    managerRefs: [],
  };
}
const home = seasonTeam(ids.homeSeasonTeam, ids.homeTeam, "Home FC");
const away = seasonTeam(ids.awaySeasonTeam, ids.awayTeam, "Away FC");

function goal(scoringTeamId: string, scorerId: string | null, playerTeam: typeof home | typeof away, goalType = "normal") {
  return {
    scoringSeasonTeamRef: new Types.ObjectId(scoringTeamId),
    scorerPlayerRef: scorerId ? new Types.ObjectId(scorerId) : null,
    playerSeasonTeamRef: playerTeam,
    goalType,
  };
}

function match(status: "live" | "completed", stage: string, goals: ReturnType<typeof goal>[]) {
  return {
    _id: new Types.ObjectId(),
    status,
    stage,
    kickoffAt: new Date("2026-11-18T12:00:00.000Z"),
    homeSeasonTeamRef: home,
    awaySeasonTeamRef: away,
    goals,
  };
}

const season = {
  _id: new Types.ObjectId(ids.season),
  name: "Test Season",
  seasonNumber: 1,
  year: 2026,
  status: "active",
  pointsRules: { win: 3, draw: 1, loss: 0 },
  standingsTieBreakers: ["points", "goalDifference", "goalsScored", "teamNameAsc"],
};

const completedGroupMatch = match("completed", "group", [
  goal(ids.homeSeasonTeam, ids.homePlayer, home),
  goal(ids.homeSeasonTeam, ids.homePlayer, home),
]);
const liveGroupMatch = match("live", "group", [
  goal(ids.awaySeasonTeam, ids.awayPlayer, away),
]);
const completedScorerMatch = match("completed", "group", [
  goal(ids.homeSeasonTeam, ids.homePlayer, home),
]);
const liveKnockoutMatch = match("live", "final", [
  goal(ids.awaySeasonTeam, ids.awayPlayer, away),
  goal(ids.awaySeasonTeam, ids.awayPlayer, away),
  goal(ids.homeSeasonTeam, ids.homePlayer, home, "own_goal"),
  goal(ids.homeSeasonTeam, null, home),
]);

const players = [
  { _id: new Types.ObjectId(ids.homePlayer), name: "Home Scorer", profilePic: null },
  { _id: new Types.ObjectId(ids.awayPlayer), name: "Away Scorer", profilePic: null },
];

function service() {
  const repository = {
    findSeason: async () => season,
    findSeasonTeams: async () => [home, away],
    findGroups: async () => [group],
    findGroupStandingsMatches: async () => [completedGroupMatch, liveGroupMatch],
    findMatchesForTopScorers: async () => [completedScorerMatch, liveKnockoutMatch],
    findSoldLots: async () => [],
    findPlayersByIds: async (playerIds: string[]) => players.filter((player) => playerIds.includes(String(player._id))),
  };
  return new SeasonStatisticsService(repository as unknown as SeasonStatisticsRepository);
}

test("group standings include completed and live group-stage matches", async () => {
  const result = await service().getStandings(ids.season);
  const rows = result.groups[0].rows;

  assert.equal(rows.length, 2);
  const homeRow = rows.find((row) => row.team.teamId === ids.homeTeam);
  const awayRow = rows.find((row) => row.team.teamId === ids.awayTeam);
  assert.ok(homeRow);
  assert.ok(awayRow);
  assert.equal(homeRow.played, 2);
  assert.equal(awayRow.played, 2);
  assert.equal(homeRow.goalsScored, 2);
  assert.equal(homeRow.goalsConceded, 1);
  assert.equal(homeRow.points, 3);
  assert.equal(awayRow.goalsScored, 1);
  assert.equal(awayRow.points, 3);
});

test("top scorers include normal goals from live matches across all stages", async () => {
  const result = await service().getTopScorers(ids.season);

  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].player._id, ids.awayPlayer);
  assert.equal(result.items[0].goals, 2);
  assert.equal(result.items[1].player._id, ids.homePlayer);
  assert.equal(result.items[1].goals, 1);
});
