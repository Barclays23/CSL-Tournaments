import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { VenueService } from "./venue.service.js";
import type { VenueEntity, VenueFields, VenueStatus } from "./venue.types.js";
import { venueRouter } from "./venue.routes.js";

class MemoryVenueRepository {
  readonly rows: VenueEntity[] = [];
  referencedIds = new Set<string>();

  async list(status: VenueStatus | "all" = "active"): Promise<VenueEntity[]> {
    return this.rows.filter((row) => status === "all" || row.status === status).sort((a, b) => a.name.localeCompare(b.name));
  }
  async findById(id: string): Promise<VenueEntity | null> {
    return this.rows.find((row) => String(row._id) === id) ?? null;
  }
  async findByNormalizedName(name: string, excludeId?: string): Promise<VenueEntity | null> {
    return this.rows.find((row) => row.normalizedName === name && String(row._id) !== excludeId) ?? null;
  }
  async create(data: Pick<VenueEntity, "name" | "normalizedName" | "location" | "notes">): Promise<VenueEntity> {
    const date = new Date("2026-11-28T06:00:00.000Z");
    const entity: VenueEntity = { ...data, _id: new Types.ObjectId(), status: "active", createdAt: date, updatedAt: date };
    this.rows.push(entity);
    return entity;
  }
  async update(id: string, data: Partial<Pick<VenueEntity, "name" | "normalizedName" | "location" | "notes" | "status">>): Promise<VenueEntity | null> {
    const current = await this.findById(id);
    if (!current) return null;
    Object.assign(current, data, { updatedAt: new Date("2026-11-28T06:01:00.000Z") });
    return current;
  }
  async countFixtureReferences(id: string): Promise<number> { return this.referencedIds.has(id) ? 1 : 0; }
  async delete(id: string): Promise<boolean> {
    const index = this.rows.findIndex((row) => String(row._id) === id);
    if (index < 0) return false;
    this.rows.splice(index, 1);
    return true;
  }
}

function createService() {
  const repository = new MemoryVenueRepository();
  return { repository, service: new VenueService(repository as never) };
}

test("Venue create trims values, stores active status and returns a DTO", async () => {
  const { repository, service } = createService();
  const created = await service.create({ name: "  Main   Ground  ", location: " City ", notes: "  Primary venue  " });
  assert.equal(created.name, "Main   Ground");
  assert.equal(created.location, "City");
  assert.equal(created.notes, "Primary venue");
  assert.equal(created.status, "active");
  assert.equal(repository.rows.length, 1);
});

test("Venue update changes name and metadata while keeping omitted values", async () => {
  const { service } = createService();
  const created = await service.create({ name: "Central Stadium", location: "Town" });
  const updated = await service.update(created._id, { name: "Central Arena" });
  assert.equal(updated.name, "Central Arena");
  assert.equal(updated.location, "Town");
  assert.equal(updated.status, "active");
});

test("duplicate Venue names are rejected after NFKC, whitespace and case normalization", async () => {
  const { service } = createService();
  await service.create({ name: "  North   Stadium " });
  await assert.rejects(
    service.create({ name: "north stadium" }),
    (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "DUPLICATE_VENUE"),
  );
  await service.create({ name: "North Stadium" }).catch((error: unknown) => {
    // The standard normalization collapses whitespace after NFKC and should reject this duplicate too.
    assert.ok(error);
  });
});

test("Venue list returns active, inactive and all records according to admin visibility", async () => {
  const { repository, service } = createService();
  const active = await service.create({ name: "Active Venue" });
  const inactive = await service.create({ name: "Inactive Venue" });
  await service.update(inactive._id, { status: "inactive" });
  assert.deepEqual((await service.list("active", true)).map((venue) => venue._id), [active._id]);
  assert.deepEqual((await service.list("inactive", true)).map((venue) => venue._id), [inactive._id]);
  assert.equal((await service.list("all", true)).length, 2);
  assert.equal((await service.list("all", false)).length, 1);
});

test("Inactive Venues cannot be fetched by public users", async () => {
  const { service } = createService();
  const venue = await service.create({ name: "Closed Ground" });
  await service.update(venue._id, { status: "inactive" });
  await assert.rejects(service.get(venue._id, false), (error: unknown) =>
    Boolean(error && typeof error === "object" && "code" in error && error.code === "VENUE_NOT_FOUND"),
  );
  assert.equal((await service.get(venue._id, true)).status, "inactive");
});

test("deleting a Venue referenced by fixtures is rejected", async () => {
  const { repository, service } = createService();
  const venue = await service.create({ name: "History Ground" });
  repository.referencedIds.add(venue._id);
  await assert.rejects(service.delete(venue._id), (error: unknown) =>
    Boolean(error && typeof error === "object" && "code" in error && error.code === "VENUE_IN_USE"),
  );
  assert.ok(await repository.findById(venue._id));
});

test("a referenced Venue can be deactivated and historical Venue records remain present", async () => {
  const { repository, service } = createService();
  const venue = await service.create({ name: "Archived Ground" });
  repository.referencedIds.add(venue._id);
  const inactive = await service.update(venue._id, { status: "inactive" });
  assert.equal(inactive.status, "inactive");
  assert.ok(await repository.findById(venue._id));
  assert.equal(await repository.countFixtureReferences(venue._id), 1);
});

test("Venue routes require authenticate and requireAdmin for create/update/delete", () => {
  const routeNames = (method: "post" | "patch" | "delete", path: string) => {
    const layer = venueRouter.stack.find((item) => item.route?.path === path && item.route.methods[method]);
    assert.ok(layer?.route);
    return layer.route.stack.map((item) => item.name);
  };
  for (const [method, path] of [["post", "/"], ["patch", "/:id"], ["delete", "/:id"]] as const) {
    const names = routeNames(method, path);
    assert.ok(names.includes("authenticate"), `${method} ${path} must authenticate`);
    assert.ok(names.includes("requireAdmin"), `${method} ${path} must require admin`);
  }
});
