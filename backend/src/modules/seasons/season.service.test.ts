import test from "node:test";
import assert from "node:assert/strict";
import { SeasonService } from "./season.service.js";
import { AppError } from "../../shared/errors/appError.js";

const id = "507f1f77bcf86cd799439011";
function service(overrides: Record<string, unknown> = {}) {
  const repository = {
    deleteIfEmptyDraft: async () => false,
    findById: async () => null,
    updateStatus: async () => null,
    ...overrides,
  };
  return new SeasonService(repository as never, {} as never, {} as never);
}

test("deleting a missing season returns 404, not a dependency conflict", async () => {
  const instance = service({ deleteIfEmptyDraft: async () => false });
  await assert.rejects(instance.delete(id), (error: unknown) =>
    error instanceof AppError && error.statusCode === 404 && error.errorCode === "SEASON_NOT_FOUND");
});

test("deleting a season with dependent records returns 409 and preserves history", async () => {
  const instance = service({ deleteIfEmptyDraft: async () => { throw new Error("SEASON_HAS_DEPENDENCIES"); } });
  await assert.rejects(instance.delete(id), (error: unknown) =>
    error instanceof AppError && error.statusCode === 409 && error.errorCode === "SEASON_HAS_DEPENDENCIES");
});

test("archiving is rejected unless the season is Completed", async () => {
  const instance = service({ findById: async () => ({ _id: id, status: "active" }) });
  await assert.rejects(instance.archive(id), (error: unknown) =>
    error instanceof AppError && error.statusCode === 409 && error.errorCode === "SEASON_ARCHIVE_BLOCKED");
});

test("archived and completed season configuration is read-only", async () => {
  const instance = service({ findById: async () => ({ _id: id, status: "completed" }) });
  await assert.rejects(instance.update(id, { name: "Changed" }), (error: unknown) =>
    error instanceof AppError && error.statusCode === 409 && error.errorCode === "SEASON_READ_ONLY");
});
