import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { PlayerService } from "./player.service.js";
import type { IPlayerRepository } from "./player.interfaces.js";
import type { PlayerEntity, PlayerFields } from "./player.types.js";

function createPlayerRecord(overrides: Partial<PlayerEntity> = {}): PlayerEntity {
  const now = new Date("2026-11-17T00:00:00.000Z");
  return {
    _id: new Types.ObjectId(),
    name: "Amal Nair",
    mobile: null,
    email: null,
    dateOfBirth: null,
    profilePic: null,
    status: "active",
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createRepository(overrides: Partial<IPlayerRepository> = {}) {
  const calls: { create?: PlayerFields; update?: Partial<PlayerFields>; deleted: boolean } = { deleted: false };
  const record = createPlayerRecord();
  const repository: IPlayerRepository = {
    findPlayers: async () => ({ items: [record], total: 1 }),
    findPlayerById: async () => record,
    findPlayerByMobile: async () => null,
    findPlayerByEmail: async () => null,
    countPlayerReferences: async () => ({ auctionLots: 0, seasonMatches: 0, legacyMatches: 0, awards: 0 }),
    createPlayer: async (data) => { calls.create = data; return createPlayerRecord(data); },
    updatePlayer: async (_id, data) => { calls.update = data; return createPlayerRecord({ ...record, ...data }); },
    deletePlayerIfUnreferenced: async () => { calls.deleted = true; return true; },
    ...overrides,
  };
  return { repository, calls, record };
}

test("PlayerService creates only permanent master fields with optional values normalized", async () => {
  const { repository, calls } = createRepository();
  const service = new PlayerService(repository);
  const result = await service.createPlayer({ name: "Amal Nair", status: "active" });
  assert.equal(result.name, "Amal Nair");
  assert.equal(calls.create?.mobile, null);
  assert.equal(calls.create?.email, null);
  assert.equal(calls.create?.dateOfBirth, null);
  assert.equal(calls.create?.profilePic, null);
  assert.equal(calls.create?.notes, null);
  assert.equal("position" in (calls.create ?? {}), false);
  assert.equal("teamRef" in (calls.create ?? {}), false);
  assert.equal("auctionStatus" in (calls.create ?? {}), false);
});

test("PlayerService partial update writes only supplied master fields", async () => {
  const { repository, calls } = createRepository();
  const service = new PlayerService(repository);
  const result = await service.updatePlayer(String(createPlayerRecord()._id), { name: "Rahul Nair" });
  assert.equal(result.name, "Rahul Nair");
  assert.deepEqual(calls.update, { name: "Rahul Nair" });
});

test("PlayerService rejects deletion while auction, match or award history references the player", async () => {
  let deleteCalled = false;
  const { repository } = createRepository({
    countPlayerReferences: async () => ({ auctionLots: 1, seasonMatches: 0, legacyMatches: 0, awards: 0 }),
    deletePlayerIfUnreferenced: async () => { deleteCalled = true; return false; },
  });
  const service = new PlayerService(repository);
  await assert.rejects(() => service.deletePlayer(String(createPlayerRecord()._id)));
  assert.equal(deleteCalled, false);
});

test("PlayerService permits deletion only after the repository confirms no references", async () => {
  const { repository, calls } = createRepository();
  const service = new PlayerService(repository);
  await service.deletePlayer(String(createPlayerRecord()._id));
  assert.equal(calls.deleted, true);
});
