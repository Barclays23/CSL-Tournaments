import assert from "node:assert/strict";
import test from "node:test";
import { newsCreateSchema, newsQuerySchema, newsUpdateSchema } from "./news.schema.js";

const validArticle = {
  title: "CSL tournament update",
  excerpt: "A short update about the CSL football tournament.",
  content: "The CSL tournament community has a new update to share with supporters.",
  status: "draft",
};

test("news create schema accepts article fields and defaults draft status", () => {
  const parsed = newsCreateSchema.parse({ ...validArticle, tags: ["Tournament"] });
  assert.equal(parsed.status, "draft");
  assert.deepEqual(parsed.tags, ["Tournament"]);
});

test("news schema rejects malformed slugs and invalid statuses", () => {
  assert.equal(newsCreateSchema.safeParse({ ...validArticle, slug: "Bad Slug!" }).success, false);
  assert.equal(newsCreateSchema.safeParse({ ...validArticle, status: "private" }).success, false);
  assert.equal(newsUpdateSchema.safeParse({ status: "published", unexpected: true }).success, false);
});

test("news query schema validates pagination and filters", () => {
  assert.deepEqual(newsQuerySchema.parse({ page: "2", limit: "10", status: "published" }), { page: 2, limit: 10, status: "published" });
  assert.equal(newsQuerySchema.safeParse({ page: 0 }).success, false);
});
