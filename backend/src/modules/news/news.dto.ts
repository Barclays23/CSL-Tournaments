import type { Asset } from "../../shared/types/common.types.js";
import type { NewsStatus } from "./news.types.js";

export interface CreateNewsDto {
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  coverImage?: Asset | null;
  tags?: string[];
  status?: NewsStatus;
  publishedAt?: Date | null;
}
export type UpdateNewsDto = Partial<CreateNewsDto>;

export interface NewsQueryDto {
  page: number;
  limit: number;
  search?: string;
  status?: NewsStatus;
}

export interface NewsResponseDto {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: Asset | null;
  tags: string[];
  status: NewsStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
