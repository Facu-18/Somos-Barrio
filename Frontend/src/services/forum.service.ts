import { api } from '../lib/api'
import type { ApiResponse, ForumSubforum, ForumThread, ForumReply, Paginated } from '../types'

export const forumService = {
  listSubforums: (barrioSlug: string) =>
    api
      .get<ApiResponse<ForumSubforum[]>>(`/barrios/${barrioSlug}/forum`)
      .then((r) => r.data.data),

  listThreads: (barrioSlug: string, subforumSlug: string, params?: { page?: number }) =>
    api
      .get<ApiResponse<Paginated<ForumThread>>>(
        `/barrios/${barrioSlug}/forum/${subforumSlug}/threads`,
        { params }
      )
      .then((r) => r.data.data),

  getThread: (barrioSlug: string, subforumSlug: string, threadId: string) =>
    api
      .get<ApiResponse<ForumThread & { replies: ForumReply[] }>>(
        `/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${threadId}`
      )
      .then((r) => r.data.data),

  createThread: (barrioSlug: string, subforumSlug: string, data: { title: string; content: string }) =>
    api
      .post<ApiResponse<ForumThread>>(
        `/barrios/${barrioSlug}/forum/${subforumSlug}/threads`,
        data
      )
      .then((r) => r.data.data),

  createReply: (barrioSlug: string, subforumSlug: string, threadId: string, data: { content: string; parentId?: string }) =>
    api
      .post<ApiResponse<ForumReply>>(
        `/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${threadId}/replies`,
        data
      )
      .then((r) => r.data.data),

  voteThread: (barrioSlug: string, subforumSlug: string, threadId: string, value: 1 | -1) =>
    api
      .post(`/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${threadId}/vote`, { value })
      .then((r) => r.data.data),
}
