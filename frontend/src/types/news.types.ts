import type { Asset } from "@/types/api.types";

export type NewsStatus = "draft" | "published" | "archived";
export interface NewsArticle {
  _id: string; title: string; slug: string; excerpt: string; content: string;
  coverImage: Asset | null; tags: string[]; status: NewsStatus;
  publishedAt: string | null; createdAt: string; updatedAt: string;
}
export interface NewsQuery {
  page?: number; limit?: number; search?: string; status?: NewsStatus | "";
}
export interface NewsWrite {
  title: string; slug?: string; excerpt: string; content: string;
  coverImage?: Asset | null; tags?: string[]; status: NewsStatus; publishedAt?: string | null;
}
