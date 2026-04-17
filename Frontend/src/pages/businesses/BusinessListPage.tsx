import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckCircle, Store } from 'lucide-react'
import { businessesService } from '../../services/businesses.service'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Select'
import { getCategoryLabel } from '../../lib/utils'
import type { BusinessCategory } from '../../types'

const CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'Todas las categorías' },
  ...(['GASTRONOMIA', 'SALUD', 'EDUCACION', 'SERVICIOS', 'COMERCIO', 'ENTRETENIMIENTO', 'TRANSPORTE', 'OTROS'] as BusinessCategory[]).map(
    (c) => ({ value: c, label: getCategoryLabel(c) })
  ),
]

export function BusinessListPage() {
  const { slug } = useParams<{ slug: string }>()
  const [category, setCategory] = useState<BusinessCategory | ''>('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['businesses', slug, { category, page }],
    queryFn: () => businessesService.list(slug!, { category: category || undefined, page }),
    enabled: !!slug,
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Comercios</h1>
        <Select
          options={CATEGORIES}
          value={category}
          onChange={(e) => { setCategory(e.target.value as BusinessCategory | ''); setPage(1) }}
          className="w-52"
        />
      </div>

      {data?.items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((b) => (
            <Link
              key={b.id}
              to={`/barrios/${slug}/businesses/${b.slug}`}
              className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
            >
              {b.imageUrl ? (
                <img src={b.imageUrl} alt={b.name} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-gray-100 flex items-center justify-center">
                  <Store size={32} className="text-gray-300" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors flex-1 truncate">
                    {b.name}
                  </h2>
                  {b.verified && <CheckCircle size={16} className="text-green-600 shrink-0" />}
                </div>
                <Badge variant="green">{getCategoryLabel(b.category)}</Badge>
                <p className="text-xs text-gray-500 mt-2 truncate">{b.address}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Store size={40} className="mx-auto mb-3 opacity-50" />
          <p>No hay comercios en esta categoría.</p>
        </div>
      )}

      {data && data.total > data.limit && (
        <div className="flex justify-center gap-2 mt-8">
          <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            Anterior
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">
            {page} / {Math.ceil(data.total / data.limit)}
          </span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(data.total / data.limit)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
