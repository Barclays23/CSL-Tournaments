import type { Types } from "mongoose";
import type { Asset, PaginatedResult } from "../../shared/types/common.types.js";
import type { CreateNewsDto, UpdateNewsDto, NewsQueryDto, NewsResponseDto } from "./news.dto.js";

export type NewsStatus = "draft" | "published" | "archived";

export interface NewsFields {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: Asset | null;
  tags: string[];
  status: NewsStatus;
  publishedAt: Date | null;
}

export interface NewsEntity extends NewsFields {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewsFilter {
  status?: NewsStatus;
  title?: { $regex: string; $options: "i" };
}

export type { CreateNewsDto, UpdateNewsDto, NewsQueryDto, NewsResponseDto };
export type { INewsRepository, INewsService, INewsController } from "./news.interfaces.js";
export type NewsListResponse = PaginatedResult<NewsResponseDto>;
