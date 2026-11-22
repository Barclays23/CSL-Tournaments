import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import type { Asset } from "../../shared/types/common.types.js";
import type { INewsRepository, INewsService, NewsEntityInput } from "./news.interfaces.js";
import type { CreateNewsDto, UpdateNewsDto, NewsQueryDto, NewsResponseDto } from "./news.dto.js";
import type { NewsEntity, NewsFilter, NewsStatus } from "./news.types.js";

function slugify(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160).replace(/-+$/g, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class NewsService implements INewsService {
  constructor(private readonly repository: INewsRepository) {}

  async list(query: NewsQueryDto, isAdmin: boolean) {
    const filter: NewsFilter = {};
    if (isAdmin) {
      if (query.status) filter.status = query.status;
    } else {
      filter.status = "published";
      filter.publishedAt = { $lte: new Date() };
    }
    if (query.search?.trim()) filter.title = { $regex: escapeRegex(query.search.trim()), $options: "i" };
    const result = await this.repository.find(filter, query.page, query.limit);
    const visible = result.items;
    return {
      items: visible.map((item) => this.toResponse(item)),
      pagination: { page: query.page, limit: query.limit, total: result.total, totalPages: Math.ceil(result.total / query.limit) },
    };
  }

  async getBySlug(slug: string, isAdmin: boolean): Promise<NewsResponseDto> {
    const item = await this.repository.findBySlug(slug);
    if (!item || (!isAdmin && (item.status !== "published" || !item.publishedAt || item.publishedAt > new Date()))) {
      throw new AppError("News article not found", 404, "NEWS_NOT_FOUND");
    }
    return this.toResponse(item);
  }

  async create(input: CreateNewsDto): Promise<NewsResponseDto> {
    const title = input.title.trim();
    const slug = await this.uniqueSlug(input.slug?.trim() || title);
    const status: NewsStatus = input.status ?? "draft";
    const publishedAt = status === "published" ? input.publishedAt ?? new Date() : input.publishedAt ?? null;
    const data: NewsEntityInput = {
      title, slug, excerpt: input.excerpt.trim(), content: input.content.trim(),
      coverImage: input.coverImage ?? null, tags: this.cleanTags(input.tags ?? []),
      status, publishedAt,
    };
    return this.toResponse(await this.repository.create(data));
  }

  async update(id: string, input: UpdateNewsDto): Promise<NewsResponseDto> {
    this.ensureId(id);
    const current = await this.repository.findById(id);
    if (!current) throw new AppError("News article not found", 404, "NEWS_NOT_FOUND");
    const update: Partial<NewsEntityInput> = {};
    if (input.title !== undefined) update.title = input.title.trim();
    if (input.slug !== undefined) update.slug = await this.uniqueSlug(input.slug || input.title || current.title, id);
    else if (input.title !== undefined && slugify(input.title) !== current.slug) update.slug = await this.uniqueSlug(input.title, id);
    if (input.excerpt !== undefined) update.excerpt = input.excerpt.trim();
    if (input.content !== undefined) update.content = input.content.trim();
    if (input.coverImage !== undefined) update.coverImage = input.coverImage as Asset | null;
    if (input.tags !== undefined) update.tags = this.cleanTags(input.tags);
    if (input.status !== undefined) {
      update.status = input.status;
      if (input.status === "published") update.publishedAt = input.publishedAt ?? current.publishedAt ?? new Date();
      else if (input.status === "draft" && input.publishedAt === undefined) update.publishedAt = null;
    }
    if (input.publishedAt !== undefined) update.publishedAt = input.publishedAt;
    const nextStatus = update.status ?? current.status;
    if (nextStatus === "published" && !update.publishedAt) update.publishedAt = current.publishedAt ?? new Date();
    const updated = await this.repository.update(id, update);
    if (!updated) throw new AppError("News article not found", 404, "NEWS_NOT_FOUND");
    return this.toResponse(updated);
  }

  async delete(id: string): Promise<void> {
    this.ensureId(id);
    if (!(await this.repository.delete(id))) throw new AppError("News article not found", 404, "NEWS_NOT_FOUND");
  }

  private async uniqueSlug(source: string, excludeId?: string): Promise<string> {
    const base = slugify(source);
    if (!base) throw new AppError("Enter a title that can be converted to a URL slug", 400, "INVALID_NEWS_SLUG");
    let candidate = base;
    let suffix = 2;
    while (await this.repository.slugExists(candidate, excludeId)) candidate = `${base.slice(0, 154)}-${suffix++}`;
    return candidate;
  }

  private cleanTags(tags: string[]): string[] {
    return [...new Set(tags.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean))].slice(0, 15);
  }

  private toResponse(item: NewsEntity): NewsResponseDto {
    return {
      _id: String(item._id), title: item.title, slug: item.slug, excerpt: item.excerpt,
      content: item.content, coverImage: item.coverImage ?? null, tags: item.tags ?? [],
      status: item.status, publishedAt: item.publishedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
    };
  }

  private ensureId(id: string): void {
    if (!Types.ObjectId.isValid(id)) throw new AppError("Invalid news ID", 400, "INVALID_ID");
  }
}
