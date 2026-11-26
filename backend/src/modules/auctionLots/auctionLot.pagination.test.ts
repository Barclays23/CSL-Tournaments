import assert from "node:assert/strict";
import test from "node:test";
import { auctionQuerySchema } from "./auctionLot.schema.js";

const seasonId = "0123456789abcdef01234567";

test("auction lot list defaults to the first page with ten lots", () => {
  const query = auctionQuerySchema.parse({ seasonId });
  assert.equal(query.page, 1);
  assert.equal(query.limit, 10);
});

test("auction lot list accepts page and limit query parameters", () => {
  const query = auctionQuerySchema.parse({ seasonId, page: "3", limit: "10" });
  assert.equal(query.page, 3);
  assert.equal(query.limit, 10);
});

test("auction lot list rejects invalid pagination values", () => {
  assert.equal(auctionQuerySchema.safeParse({ seasonId, page: "0" }).success, false);
  assert.equal(auctionQuerySchema.safeParse({ seasonId, limit: "101" }).success, false);
});
