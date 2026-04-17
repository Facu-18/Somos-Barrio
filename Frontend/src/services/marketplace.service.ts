import { api } from '../lib/api'
import type { ApiResponse, MarketplacePost, MarketplaceCategory, Paginated } from '../types'

export const marketplaceService = {
  list: (barrioSlug: string, params?: { category?: MarketplaceCategory; page?: number }) =>
    api
      .get<ApiResponse<Paginated<MarketplacePost>>>(`/barrios/${barrioSlug}/marketplace`, { params })
      .then((r) => r.data.data),

  get: (barrioSlug: string, postId: string) =>
    api
      .get<ApiResponse<MarketplacePost>>(`/barrios/${barrioSlug}/marketplace/${postId}`)
      .then((r) => r.data.data),

  create: (barrioSlug: string, data: Partial<MarketplacePost>) =>
    api
      .post<ApiResponse<MarketplacePost>>(`/barrios/${barrioSlug}/marketplace`, data)
      .then((r) => r.data.data),

  update: (barrioSlug: string, id: string, data: Partial<MarketplacePost>) =>
    api
      .patch<ApiResponse<MarketplacePost>>(`/barrios/${barrioSlug}/marketplace/${id}`, data)
      .then((r) => r.data.data),

  delete: (barrioSlug: string, id: string) =>
    api.delete(`/barrios/${barrioSlug}/marketplace/${id}`),
}
