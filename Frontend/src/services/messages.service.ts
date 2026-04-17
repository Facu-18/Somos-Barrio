import { api } from '../lib/api'
import type { ApiResponse, Message, Paginated } from '../types'

export const messagesService = {
  list: (type: 'inbox' | 'sent', page = 1) =>
    api
      .get<ApiResponse<Paginated<Message>>>('/messages', { params: { type, page } })
      .then((r) => r.data.data),

  send: (data: { receiverId: string; content: string; postId?: string }) =>
    api.post<ApiResponse<Message>>('/messages', data).then((r) => r.data.data),

  markRead: (messageId: string) =>
    api.patch<ApiResponse<Message>>(`/messages/${messageId}/read`).then((r) => r.data.data),
}
