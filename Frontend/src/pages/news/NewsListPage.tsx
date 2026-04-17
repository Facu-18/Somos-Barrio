import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { newsService } from '../../services/news.service'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Select'
import { formatRelative, getCategoryLabel } from '../../lib/utils'
import type { NewsCategory } from '../../types'

const CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'Todas las categorías' },
  ...(['GENERAL', 'SEGURIDAD', 'CULTURA', 'DEPORTES', 'POLITICA', 'SALUD', 'EDUCACION', 'ECONOMIA'] as NewsCategory[]).map(
    (c) => ({ value: c, label: getCategoryLabel(c) })
  ),
]

export function NewsListPage() {
  const { slug } = useParams<{ slug: string }>()
  const [category, setCategory] = useState<NewsCategory | ''>('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['news', slug, { category, page }],
    queryFn: () => newsService.list(slug!, { category: category || undefined, page }),
    enabled: !!slug,
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Noticias</h1>
        <Select
          options={CATEGORIES}
          value={category}
          onChange={(e) => { setCategory(e.target.value as NewsCategory | ''); setPage(1) }}
          className="w-48"
        />
      </div>

      {data?.items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((n) => (
            <Link
              key={n.id}
              to={`/barrios/${slug}/news/${n.slug}`}
              className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
            >
              {n.imageUrl && (
                <img
                  src={n.imageUrl}
                  alt={n.title}
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="blue">{getCategoryLabel(n.category)}</Badge>
                  <span className="text-xs text-gray-400">{formatRelative(n.createdAt)}</span>
                </div>
                <h2 className="font-semibold text-gray-900 group-hover:text-green-700 line-clamp-2 transition-colors">
                  {n.title}
                </h2>
                {n.summary && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{n.summary}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">Por {n.author.name}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p>No hay noticias en esta categoría.</p>
        </div>
      )}

      {data && data.total > data.limit && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Anterior
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">
            {page} / {Math.ceil(data.total / data.limit)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(data.total / data.limit)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
