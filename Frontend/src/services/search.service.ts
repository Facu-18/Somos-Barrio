import { api } from '../lib/api'
import type { ApiResponse, News, Business, MarketplacePost, ForumThread } from '../types'

export interface SearchResults {
  news: News[]
  businesses: Business[]
  marketplace: MarketplacePost[]
  forum: ForumThread[]
}

export const searchService = {
  search: (q: string, barrioSlug?: string, types?: string) =>
    api
      .get<ApiResponse<SearchResults>>('/search', { params: { q, barrioSlug, types } })
      .then((r) => r.data.data),
}
