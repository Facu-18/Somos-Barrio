import { api } from '../lib/api'
import type { ApiResponse, Barrio, Paginated } from '../types'

export const barriosService = {
  list: () =>
    api.get<ApiResponse<Barrio[]>>('/barrios').then((r) => r.data.data),

  get: (slug: string) =>
    api.get<ApiResponse<Barrio>>(`/barrios/${slug}`).then((r) => r.data.data),
}
