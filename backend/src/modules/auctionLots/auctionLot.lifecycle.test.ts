import test from "node:test";
import assert from "node:assert/strict";
import { canDeletePendingAuctionLot, canUpdateAuctionLot } from "./auctionLot.lifecycle.js";

test("Pending lot details can be edited before the auction starts", () => {
  assert.equal(canUpdateAuctionLot("upcoming", "not_started", "pending", "pending"), true);
});

test("Pending lots cannot be sold or moved to another status before the auction starts", () => {
  assert.equal(canUpdateAuctionLot("upcoming", "not_started", "pending", "sold"), false);
  assert.equal(canUpdateAuctionLot("upcoming", "not_started", "pending", "unsold"), false);
});

test("historical or already assigned lots cannot be edited before the auction starts", () => {
  assert.equal(canUpdateAuctionLot("upcoming", "not_started", "sold", "sold"), false);
  assert.equal(canUpdateAuctionLot("upcoming", "not_started", "withdrawn", "pending"), false);
});

test("lot updates remain available while an eligible season auction is in progress", () => {
  assert.equal(canUpdateAuctionLot("upcoming", "in_progress", "pending", "sold"), true);
  assert.equal(canUpdateAuctionLot("active", "in_progress", "sold", "withdrawn"), true);
});

test("Pending lots can be deleted before auction start and while auction is in progress", () => {
  assert.equal(canDeletePendingAuctionLot("upcoming", "not_started", "pending"), true);
  assert.equal(canDeletePendingAuctionLot("active", "in_progress", "pending"), true);
});

test("non-Pending lots and completed seasons cannot be deleted", () => {
  assert.equal(canDeletePendingAuctionLot("upcoming", "not_started", "sold"), false);
  assert.equal(canDeletePendingAuctionLot("upcoming", "not_started", "unsold"), false);
  assert.equal(canDeletePendingAuctionLot("upcoming", "not_started", "withdrawn"), false);
  assert.equal(canDeletePendingAuctionLot("upcoming", "completed", "pending"), false);
  assert.equal(canDeletePendingAuctionLot("completed", "completed", "pending"), false);
});
