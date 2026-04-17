import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, ThumbsUp, ThumbsDown } from 'lucide-react'
import { forumService } from '../../services/forum.service'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Textarea'
import { formatRelative } from '../../lib/utils'
import { useAuthStore } from '../../store/auth'
import type { ForumReply } from '../../types'

function ReplyItem({ reply, barrioSlug, subforumSlug, threadId }: {
  reply: ForumReply
  barrioSlug: string
  subforumSlug: string
  threadId: string
}) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [replyContent, setReplyContent] = useState('')
  const [showReply, setShowReply] = useState(false)

  const replyMutation = useMutation({
    mutationFn: () =>
      forumService.createReply(barrioSlug, subforumSlug, threadId, {
        content: replyContent,
        parentId: reply.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-thread', barrioSlug, subforumSlug, threadId] })
      setReplyContent('')
      setShowReply(false)
    },
  })

  return (
    <div className="ml-6 border-l-2 border-gray-100 pl-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold">
          {reply.author.name[0]}
        </div>
        <span className="text-sm font-medium">{reply.author.name}</span>
        <span className="text-xs text-gray-400">{formatRelative(reply.createdAt)}</span>
      </div>
      <p className="text-sm text-gray-700 mb-2">{reply.content}</p>

      {user && !showReply && (
        <button
          onClick={() => setShowReply(true)}
          className="text-xs text-gray-400 hover:text-green-700"
        >
          Responder
        </button>
      )}

      {showReply && (
        <div className="mt-2">
          <Textarea
            rows={2}
            placeholder="Tu respuesta..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={() => replyMutation.mutate()} loading={replyMutation.isPending}>
              Responder
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowReply(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {reply.children?.map((child) => (
        <ReplyItem key={child.id} reply={child} barrioSlug={barrioSlug} subforumSlug={subforumSlug} threadId={threadId} />
      ))}
    </div>
  )
}

export function ThreadDetailPage() {
  const { slug, subforumSlug, threadId } = useParams<{ slug: string; subforumSlug: string; threadId: string }>()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [replyContent, setReplyContent] = useState('')

  const { data: thread, isLoading } = useQuery({
    queryKey: ['forum-thread', slug, subforumSlug, threadId],
    queryFn: () => forumService.getThread(slug!, subforumSlug!, threadId!),
    enabled: !!slug && !!subforumSlug && !!threadId,
  })

  const voteMutation = useMutation({
    mutationFn: (value: 1 | -1) => forumService.voteThread(slug!, subforumSlug!, threadId!, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forum-thread', slug, subforumSlug, threadId] }),
  })

  const replyMutation = useMutation({
    mutationFn: () =>
      forumService.createReply(slug!, subforumSlug!, threadId!, { content: replyContent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-thread', slug, subforumSlug, threadId] })
      setReplyContent('')
    },
  })

  if (isLoading) return <Spinner />
  if (!thread) return <p className="text-center text-gray-500">Hilo no encontrado</p>

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to={`/barrios/${slug}/forum/${subforumSlug}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={14} />
        Volver al subforo
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{thread.title}</h1>
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
            {thread.author.name[0]}
          </div>
          <div>
            <span className="text-sm font-medium">{thread.author.name}</span>
            <p className="text-xs text-gray-400">{formatRelative(thread.createdAt)}</p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => voteMutation.mutate(1)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-600"
            >
              <ThumbsUp size={15} /> {thread.upvotes}
            </button>
            <button
              onClick={() => voteMutation.mutate(-1)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500"
            >
              <ThumbsDown size={15} /> {thread.downvotes}
            </button>
          </div>
        </div>
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{thread.content}</p>
      </div>

      <h2 className="font-semibold text-gray-900 mb-4">
        Respuestas ({(thread as any).replies?.length ?? 0})
      </h2>

      <div className="flex flex-col gap-4 mb-6">
        {((thread as any).replies as ForumReply[])?.map((reply: ForumReply) => (
          <div key={reply.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                {reply.author.name[0]}
              </div>
              <span className="text-sm font-medium">{reply.author.name}</span>
              <span className="text-xs text-gray-400">{formatRelative(reply.createdAt)}</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">{reply.content}</p>

            {reply.children?.map((child) => (
              <ReplyItem
                key={child.id}
                reply={child}
                barrioSlug={slug!}
                subforumSlug={subforumSlug!}
                threadId={threadId!}
              />
            ))}
          </div>
        ))}
      </div>

      {user && !thread.isLocked && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-medium text-gray-800 mb-3">Tu respuesta</h3>
          <Textarea
            rows={4}
            placeholder="Escribí tu respuesta..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
          />
          <Button
            className="mt-3"
            onClick={() => replyMutation.mutate()}
            loading={replyMutation.isPending}
          >
            Responder
          </Button>
        </div>
      )}
    </div>
  )
}
