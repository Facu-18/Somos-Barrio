import { api } from '../lib/api'
import type { ApiResponse, Event, EventRsvpStatus, Paginated } from '../types'

export const eventsService = {
  list: (barrioSlug: string, params?: { page?: number }) =>
    api
      .get<ApiResponse<Paginated<Event>>>(`/barrios/${barrioSlug}/events`, { params })
      .then((r) => r.data.data),

  get: (barrioSlug: string, eventId: string) =>
    api
      .get<ApiResponse<Event>>(`/barrios/${barrioSlug}/events/${eventId}`)
      .then((r) => r.data.data),

  create: (barrioSlug: string, data: Partial<Event>) =>
    api
      .post<ApiResponse<Event>>(`/barrios/${barrioSlug}/events`, data)
      .then((r) => r.data.data),

  rsvp: (barrioSlug: string, eventId: string, status: EventRsvpStatus) =>
    api
      .post(`/barrios/${barrioSlug}/events/${eventId}/rsvp`, { status })
      .then((r) => r.data.data),
}
