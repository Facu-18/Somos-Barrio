import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, Plus, ThumbsUp, ThumbsDown, Pin, Lock } from 'lucide-react'
import { forumService } from '../../services/forum.service'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { formatRelative } from '../../lib/utils'
import { useAuthStore } from '../../store/auth'

export function ThreadListPage() {
  const { slug, subforumSlug } = useParams<{ slug: string; subforumSlug: string }>()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['forum-threads', slug, subforumSlug, page],
    queryFn: () => forumService.listThreads(slug!, subforumSlug!, { page }),
    enabled: !!slug && !!subforumSlug,
  })

  const createMutation = useMutation({
    mutationFn: () => forumService.createThread(slug!, subforumSlug!, { title, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-threads', slug, subforumSlug] })
      setTitle('')
      setContent('')
      setShowForm(false)
    },
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          to={`/barrios/${slug}/forum`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={14} />
          Foro
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900 capitalize">{subforumSlug?.replace(/-/g, ' ')}</h1>
        {user && (
          <Button size="sm" className="ml-auto" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} />
            Nuevo hilo
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-4">Crear nuevo hilo</h2>
          <div className="flex flex-col gap-3">
            <Input
              label="Título"
              placeholder="Título del hilo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              label="Contenido"
              rows={4}
              placeholder="Escribí tu mensaje..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>
                Publicar
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {data?.items.length ? (
        <div className="flex flex-col gap-3">
          {data.items.map((t) => (
            <Link
              key={t.id}
              to={`/barrios/${slug}/forum/${subforumSlug}/${t.id}`}
              className="group bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 text-xs text-gray-400 shrink-0 pt-0.5">
                  <ThumbsUp size={14} />
                  <span>{t.upvotes}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {t.isPinned && <Pin size={13} className="text-green-600" />}
                    {t.isLocked && <Lock size={13} className="text-gray-400" />}
                    <h2 className="font-medium text-gray-900 group-hover:text-green-700 transition-colors line-clamp-1">
                      {t.title}
                    </h2>
                  </div>
                  <p className="text-xs text-gray-400">
                    Por {t.author.name} · {formatRelative(t.createdAt)} · {t._count?.replies ?? 0} respuestas
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p>No hay hilos en este subforo todavía.</p>
        </div>
      )}

      {data && data.total > data.limit && (
        <div className="flex justify-center gap-2 mt-8">
          <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            Anterior
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">{page} / {Math.ceil(data.total / data.limit)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(data.total / data.limit)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
