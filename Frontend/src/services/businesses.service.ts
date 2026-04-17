import { api } from '../lib/api'
import type { ApiResponse, Business, BusinessCategory, Paginated, Review } from '../types'

export const businessesService = {
  list: (barrioSlug: string, params?: { category?: BusinessCategory; verified?: boolean; page?: number }) =>
    api
      .get<ApiResponse<Paginated<Business>>>(`/barrios/${barrioSlug}/businesses`, { params })
      .then((r) => r.data.data),

  get: (barrioSlug: string, businessSlug: string) =>
    api
      .get<ApiResponse<Business>>(`/barrios/${barrioSlug}/businesses/${businessSlug}`)
      .then((r) => r.data.data),

  create: (barrioSlug: string, data: Partial<Business>) =>
    api
      .post<ApiResponse<Business>>(`/barrios/${barrioSlug}/businesses`, data)
      .then((r) => r.data.data),

  update: (barrioSlug: string, slug: string, data: Partial<Business>) =>
    api
      .patch<ApiResponse<Business>>(`/barrios/${barrioSlug}/businesses/${slug}`, data)
      .then((r) => r.data.data),

  delete: (barrioSlug: string, slug: string) =>
    api.delete(`/barrios/${barrioSlug}/businesses/${slug}`),

  listReviews: (barrioSlug: string, businessSlug: string) =>
    api
      .get<ApiResponse<{ items: Review[]; total: number; averageRating: number | null }>>(
        `/barrios/${barrioSlug}/businesses/${businessSlug}/reviews`
      )
      .then((r) => r.data.data),

  createReview: (barrioSlug: string, businessSlug: string, data: { rating: number; comment?: string }) =>
    api
      .post<ApiResponse<Review>>(`/barrios/${barrioSlug}/businesses/${businessSlug}/reviews`, data)
      .then((r) => r.data.data),
}
