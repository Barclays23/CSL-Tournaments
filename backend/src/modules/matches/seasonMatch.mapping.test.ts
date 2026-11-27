import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { SeasonMatchService } from "./seasonMatch.service.js";
import type { SeasonMatchRepository } from "./seasonMatch.repository.js";
import type { PopulatedSeasonMatch } from "./seasonMatch.types.js";

test("list maps legacy goals and cards without embedded timestamps", async () => {
  const matchCreatedAt = new Date("2026-11-20T10:00:00.000Z");
  const id = () => new Types.ObjectId();
  const match = {
    _id: id(),
    seasonRef: id(),
    matchNumber: 1,
    roundNumber: 1,
    stage: "group",
    groupRef: null,
    kickoffAt: new Date("2026-11-21T10:00:00.000Z"),
    venueRef: id(),
    homeSeasonTeamRef: id(),
    awaySeasonTeamRef: id(),
    status: "live",
    goals: [{
      _id: id(),
      scoringSeasonTeamRef: id(),
      scorerPlayerRef: null,
      playerSeasonTeamRef: null,
      goalType: "own_goal",
    }],
    cards: [{
      _id: id(),
      seasonTeamRef: id(),
      playerRef: id(),
      cardType: "yellow_card",
    }],
    penaltyShootout: null,
    winnerSeasonTeamRef: null,
    notes: null,
    resolutionHistory: [],
    statusHistory: [],
    correctionHistory: [],
    createdAt: matchCreatedAt,
    updatedAt: matchCreatedAt,
  } as unknown as PopulatedSeasonMatch;

  const repo = {
    find: async () => ({ items: [match], total: 1 }),
  } as unknown as SeasonMatchRepository;
  const service = new SeasonMatchService(repo);

  const result = await service.list(String(match.seasonRef), {
    page: 1,
    limit: 10,
  });

  assert.equal(result.items[0]?.goals[0]?.createdAt, matchCreatedAt.toISOString());
  assert.equal(result.items[0]?.cards[0]?.createdAt,matchCreatedAt.toISOString());
  assert.equal(result.items[0]?.actualStartedAt,null);
  assert.deepEqual(result.items[0]?.clock.periodElapsedSecondsByPeriod,{firstHalf:0,secondHalf:0,extraTimeFirstHalf:0,extraTimeSecondHalf:0});
});
