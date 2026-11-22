import { readSeasonDb, commitSeasonDb } from "@/mocks/seasonStore";
import { isAdmin, requireAdmin } from "@/mocks/store";
import { createMockObjectId } from "@/mocks/objectId";
import type { ApiResponse } from "@/types/api.types";
import type { NewsArticle, NewsQuery, NewsStatus, NewsWrite } from "@/types/news.types";
import type { MockNews } from "@/mocks/seasonSeed";
import { ApiError } from "@/utils/errorHandler";

const now = () => new Date().toISOString();
const fail = (status: number, message: string): never => { throw new ApiError(status, message, { errorCode: status === 409 ? "CONFLICT" : "RULE" }); };
const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160).replace(/-+$/g, "");
const uniqueSlug = (db: ReturnType<typeof readSeasonDb>, value: string, excludeId?: string) => {
  const base = slugify(value);
  if (!base) return fail(422, "Enter a title that can be converted to a slug");
  let slug = base, suffix = 2;
  while (db.news.some((item) => item.slug === slug && item._id !== excludeId)) slug = `${base.slice(0, 154)}-${suffix++}`;
  return slug;
};
const present = (item: MockNews): NewsArticle => ({ ...item, coverImage: item.coverImage ?? null, tags: item.tags ?? [] });
const ok = <T>(message: string, data: T, pagination?: ApiResponse<T>["pagination"]): ApiResponse<T> => ({ success: true, message, data, ...(pagination ? { pagination } : {}) });

export const newsPreviewRepository = {
  async getNews(query: NewsQuery = {}): Promise<ApiResponse<NewsArticle[]>> {
    const db = readSeasonDb(), admin = isAdmin();
    let items = db.news.filter((item) => admin ? (!query.status || item.status === query.status) : item.status === "published" && Boolean(item.publishedAt && item.publishedAt <= now()));
    if (query.search?.trim()) { const needle = query.search.trim().toLowerCase(); items = items.filter((item) => item.title.toLowerCase().includes(needle)); }
    items.sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt) || b._id.localeCompare(a._id));
    const page = Math.max(1, query.page ?? 1), limit = Math.min(50, Math.max(1, query.limit ?? 12));
    const total = items.length, totalPages = Math.max(1, Math.ceil(total / limit)), safePage = Math.min(page, totalPages);
    return ok("News articles loaded", items.slice((safePage - 1) * limit, safePage * limit).map(present), { page: safePage, limit, total, totalPages });
  },
  async getNewsBySlug(slug: string): Promise<ApiResponse<NewsArticle>> {
    const db = readSeasonDb(), item = db.news.find((record) => record.slug === slug);
    if (!item || (!isAdmin() && (item.status !== "published" || !item.publishedAt || item.publishedAt > now()))) return fail(404, "News article not found");
    return ok("News article loaded", present(item));
  },
  async createNews(input: NewsWrite): Promise<ApiResponse<NewsArticle>> {
    requireAdmin();
    const db = readSeasonDb(), date = now(), status: NewsStatus = input.status ?? "draft";
    const item: MockNews = {
      _id: createMockObjectId(), title: input.title.trim(), slug: uniqueSlug(db, input.slug?.trim() || input.title),
      excerpt: input.excerpt.trim(), content: input.content.trim(), coverImage: input.coverImage ?? null,
      tags: [...new Set((input.tags ?? []).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean))],
      status, publishedAt: status === "published" ? input.publishedAt ?? date : input.publishedAt ?? null,
      createdAt: date, updatedAt: date,
    };
    db.news.push(item); commitSeasonDb(db);
    return ok("News article created", present(item));
  },
  async updateNews(id: string, input: Partial<NewsWrite>): Promise<ApiResponse<NewsArticle>> {
    requireAdmin();
    const db = readSeasonDb(), item = db.news.find((record) => record._id === id);
    if (!item) return fail(404, "News article not found");
    if (input.title !== undefined) item.title = input.title.trim();
    if (input.slug !== undefined) item.slug = uniqueSlug(db, input.slug || input.title || item.title, id);
    else if (input.title !== undefined && slugify(input.title) !== item.slug) item.slug = uniqueSlug(db, input.title, id);
    if (input.excerpt !== undefined) item.excerpt = input.excerpt.trim();
    if (input.content !== undefined) item.content = input.content.trim();
    if (input.coverImage !== undefined) item.coverImage = input.coverImage;
    if (input.tags !== undefined) item.tags = [...new Set(input.tags.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean))];
    if (input.status !== undefined) {
      item.status = input.status;
      if (input.status === "published") item.publishedAt = input.publishedAt ?? item.publishedAt ?? now();
      else if (input.status === "draft" && input.publishedAt === undefined) item.publishedAt = null;
    }
    if (input.publishedAt !== undefined) item.publishedAt = input.publishedAt;
    item.updatedAt = now(); commitSeasonDb(db);
    return ok("News article updated", present(item));
  },
  async deleteNews(id: string): Promise<ApiResponse<null>> {
    requireAdmin();
    const db = readSeasonDb(), index = db.news.findIndex((item) => item._id === id);
    if (index < 0) return fail(404, "News article not found");
    db.news.splice(index, 1); commitSeasonDb(db);
    return ok("News article deleted", null);
  },
};
