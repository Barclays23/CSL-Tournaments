import { USE_MOCK_API } from "@/config/env";
import { newsPreviewRepository } from "@/mocks/newsRepository";
import { api, run } from "@/services/api";
import type { ApiResponse } from "@/types/api.types";
import type { NewsArticle, NewsQuery, NewsWrite } from "@/types/news.types";

export function getNews(params: NewsQuery = {}) {
  return run(() => USE_MOCK_API
    ? newsPreviewRepository.getNews(params)
    : api.get<ApiResponse<NewsArticle[]>>("/news", { params }).then((response) => response.data));
}
export function getNewsBySlug(slug: string) {
  return run(() => USE_MOCK_API
    ? newsPreviewRepository.getNewsBySlug(slug)
    : api.get<ApiResponse<NewsArticle>>(`/news/slug/${encodeURIComponent(slug)}`).then((response) => response.data));
}
export function createNews(data: NewsWrite) {
  return run(() => USE_MOCK_API
    ? newsPreviewRepository.createNews(data)
    : api.post<ApiResponse<NewsArticle>>("/news", data).then((response) => response.data));
}
export function updateNews(id: string, data: Partial<NewsWrite>) {
  return run(() => USE_MOCK_API
    ? newsPreviewRepository.updateNews(id, data)
    : api.patch<ApiResponse<NewsArticle>>(`/news/${id}`, data).then((response) => response.data));
}
export function deleteNews(id: string) {
  return run(() => USE_MOCK_API
    ? newsPreviewRepository.deleteNews(id)
    : api.delete<ApiResponse<null>>(`/news/${id}`).then((response) => response.data));
}
