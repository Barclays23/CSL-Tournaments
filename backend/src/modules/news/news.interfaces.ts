import type { ControllerMethod, PaginatedResult } from "../../shared/types/common.types.js";
import type { CreateNewsDto, UpdateNewsDto, NewsQueryDto, NewsResponseDto } from "./news.dto.js";
import type { NewsEntity, NewsFilter } from "./news.types.js";

export type NewsEntityInput = Omit<NewsEntity, "_id" | "createdAt" | "updatedAt">;

export interface INewsRepository {
  find(filter: NewsFilter, page: number, limit: number): Promise<{ items: NewsEntity[]; total: number }>;
  findById(id: string): Promise<NewsEntity | null>;
  findBySlug(slug: string): Promise<NewsEntity | null>;
  slugExists(slug: string, excludeId?: string): Promise<boolean>;
  create(data: NewsEntityInput): Promise<NewsEntity>;
  update(id: string, data: Partial<NewsEntityInput>): Promise<NewsEntity | null>;
  delete(id: string): Promise<boolean>;
}

export interface INewsService {
  list(query: NewsQueryDto, isAdmin: boolean): Promise<PaginatedResult<NewsResponseDto>>;
  getBySlug(slug: string, isAdmin: boolean): Promise<NewsResponseDto>;
  create(input: CreateNewsDto): Promise<NewsResponseDto>;
  update(id: string, input: UpdateNewsDto): Promise<NewsResponseDto>;
  delete(id: string): Promise<void>;
}

export interface INewsController {
  list: ControllerMethod;
  getBySlug: ControllerMethod;
  create: ControllerMethod;
  update: ControllerMethod;
  delete: ControllerMethod;
}
