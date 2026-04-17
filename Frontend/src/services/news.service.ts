import { api } from '../lib/api'
import type { ApiResponse, News, NewsCategory, Paginated } from '../types'

export const newsService = {
  list: (barrioSlug: string, params?: { category?: NewsCategory; page?: number; limit?: number }) =>
    api
      .get<ApiResponse<Paginated<News>>>(`/barrios/${barrioSlug}/news`, { params })
      .then((r) => r.data.data),

  get: (barrioSlug: string, newsSlug: string) =>
    api
      .get<ApiResponse<News>>(`/barrios/${barrioSlug}/news/${newsSlug}`)
      .then((r) => r.data.data),

  create: (barrioSlug: string, data: Partial<News>) =>
    api
      .post<ApiResponse<News>>(`/barrios/${barrioSlug}/news`, data)
      .then((r) => r.data.data),

  update: (barrioSlug: string, newsSlug: string, data: Partial<News>) =>
    api
      .patch<ApiResponse<News>>(`/barrios/${barrioSlug}/news/${newsSlug}`, data)
      .then((r) => r.data.data),

  delete: (barrioSlug: string, newsSlug: string) =>
    api.delete(`/barrios/${barrioSlug}/news/${newsSlug}`),
}
