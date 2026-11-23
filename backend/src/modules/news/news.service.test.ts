import assert from "node:assert/strict";
import { Types } from "mongoose";
import test from "node:test";
import { NewsService } from "./news.service.js";
import type { INewsRepository, NewsEntityInput } from "./news.interfaces.js";
import type { NewsEntity, NewsFilter } from "./news.types.js";

class MemoryNewsRepository implements INewsRepository {
  items: NewsEntity[] = [];
  async find(filter: NewsFilter, page: number, limit: number) {
    let records = this.items.filter((item) => {
      if (filter.status && item.status !== filter.status) return false;
      if (filter.publishedAt && (!item.publishedAt || item.publishedAt > filter.publishedAt.$lte)) return false;
      if (filter.title && !new RegExp(filter.title.$regex, filter.title.$options).test(item.title)) return false;
      return true;
    }).sort((a,b)=>(b.publishedAt?.getTime() ?? b.createdAt.getTime())-(a.publishedAt?.getTime() ?? a.createdAt.getTime()));
    const total = records.length;
    records = records.slice((page-1)*limit,page*limit);
    return { items: records, total };
  }
  async findById(id: string) { return this.items.find((item)=>String(item._id)===id) ?? null; }
  async findBySlug(slug: string) { return this.items.find((item)=>item.slug===slug) ?? null; }
  async slugExists(slug: string, excludeId?: string) { return this.items.some((item)=>item.slug===slug && String(item._id)!==excludeId); }
  async create(data: NewsEntityInput) {
    const now = new Date();
    const item: NewsEntity = { ...data, _id: new Types.ObjectId(), createdAt: now, updatedAt: now };
    this.items.push(item); return item;
  }
  async update(id: string, data: Partial<NewsEntityInput>) {
    const item = await this.findById(id); if (!item) return null;
    Object.assign(item, data, { updatedAt: new Date() }); return item;
  }
  async delete(id: string) {
    const index = this.items.findIndex((item)=>String(item._id)===id);
    if(index<0)return false; this.items.splice(index,1); return true;
  }
}

const input = { title: "CSL season update", excerpt: "The latest update from the CSL football tournament.", content: "The tournament committee has shared a new update for all supporters.", status: "published" as const };

test("news service generates unique slugs and publication dates", async () => {
  const repository = new MemoryNewsRepository(), service = new NewsService(repository);
  const first = await service.create(input), second = await service.create(input);
  assert.equal(first.slug, "csl-season-update");
  assert.equal(second.slug, "csl-season-update-2");
  assert.ok(first.publishedAt);
});

test("public listing and detail hide drafts and future publications", async () => {
  const repository = new MemoryNewsRepository(), service = new NewsService(repository);
  const visible = await service.create(input);
  const draft = await service.create({ ...input, title: "Private draft", status: "draft" });
  const future = await service.create({ ...input, title: "Future announcement", publishedAt: new Date(Date.now()+86400000) });
  const publicList = await service.list({ page: 1, limit: 10 }, false);
  assert.deepEqual(publicList.items.map((item)=>item._id), [visible._id]);
  await assert.rejects(() => service.getBySlug(draft.slug, false), { statusCode: 404 });
  await assert.rejects(() => service.getBySlug(future.slug, false), { statusCode: 404 });
  assert.equal((await service.getBySlug(draft.slug, true))._id, draft._id);
});

test("updating title refreshes slug and archive hides the article from public readers", async () => {
  const repository = new MemoryNewsRepository(), service = new NewsService(repository);
  const created = await service.create(input);
  const renamed = await service.update(created._id, { title: "CSL final tournament news" });
  assert.equal(renamed.slug, "csl-final-tournament-news");
  await service.update(created._id, { status: "archived" });
  await assert.rejects(() => service.getBySlug(renamed.slug, false), { statusCode: 404 });
  assert.equal((await service.list({ page: 1, limit: 10, status: "archived" }, true)).items.length, 1);
});

test("publishing a draft without a date assigns a publication timestamp", async () => {
  const repository = new MemoryNewsRepository(), service = new NewsService(repository);
  const draft = await service.create({ ...input, status: "draft" });
  const published = await service.update(draft._id, { status: "published", publishedAt: null });
  assert.ok(published.publishedAt);
  assert.equal((await service.list({ page: 1, limit: 10 }, false)).items.length, 1);
});


test("news service maps concurrent slug index conflicts to a validation conflict", async () => {
  const repository = new MemoryNewsRepository();
  repository.create = async () => {
    throw Object.assign(new Error("duplicate key"), { code: 11000, keyPattern: { slug: 1 } });
  };
  const service = new NewsService(repository);

  await assert.rejects(
    () => service.create(input),
    (error: unknown) => error instanceof Error
      && "statusCode" in error
      && error.statusCode === 409
      && "errorCode" in error
      && error.errorCode === "DUPLICATE_NEWS_SLUG",
  );
});

test("news service maps concurrent slug update conflicts to a validation conflict", async () => {
  const repository = new MemoryNewsRepository();
  const service = new NewsService(repository);
  const created = await service.create(input);
  repository.update = async () => {
    throw Object.assign(new Error("duplicate key"), { code: 11000, keyPattern: { slug: 1 } });
  };

  await assert.rejects(
    () => service.update(created._id, { slug: "occupied-slug" }),
    (error: unknown) => error instanceof Error
      && "statusCode" in error
      && error.statusCode === 409
      && "errorCode" in error
      && error.errorCode === "DUPLICATE_NEWS_SLUG",
  );
});
