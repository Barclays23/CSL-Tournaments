import test from "node:test";
import assert from "node:assert/strict";
import { playerCreateSchema, playerQuerySchema, playerUpdateSchema } from "./player.schema.js";

test("Player master creation accepts optional contact and profile fields", () => {
  const result = playerCreateSchema.safeParse({ name: "Amal Nair" });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.status, "active");
    assert.equal(result.data.mobile, null);
    assert.equal(result.data.email, null);
    assert.equal(result.data.dateOfBirth, null);
  }
});

test("Player master creation rejects season and auction fields", () => {
  for (const field of ["position", "isIconPlayer", "isGoalkeeper", "teamRef", "jerseyNo", "auctionPrice", "auctionStatus"]) {
    const result = playerCreateSchema.safeParse({ name: "Amal Nair", [field]: "unsupported" });
    assert.equal(result.success, false, `Expected ${field} to be rejected`);
  }
});

test("Player master updates support partial profile changes but reject empty and legacy updates", () => {
  assert.equal(playerUpdateSchema.safeParse({ notes: "Captain" }).success, true);
  assert.equal(playerUpdateSchema.safeParse({}).success, false);
  assert.equal(playerUpdateSchema.safeParse({ jerseyNo: 10 }).success, false);
});

test("Player list query only accepts master-data search and status filters", () => {
  assert.equal(playerQuerySchema.safeParse({ page: "1", limit: "12", search: "Amal", status: "active" }).success, true);
  assert.equal(playerQuerySchema.safeParse({ position: "FW" }).success, false);
  assert.equal(playerQuerySchema.safeParse({ auctionStatus: "sold" }).success, false);
  assert.equal(playerQuerySchema.safeParse({ teamRef: "507f1f77bcf86cd799439011" }).success, false);
});
