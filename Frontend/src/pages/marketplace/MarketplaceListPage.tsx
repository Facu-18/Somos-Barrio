import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { marketplaceService } from '../../services/marketplace.service'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Select'
import { formatRelative, getCategoryLabel } from '../../lib/utils'
import type { MarketplaceCategory } from '../../types'

const CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'Todas las categorías' },
  ...(['VENTA', 'ALQUILER', 'BUSCO', 'REGALO', 'INTERCAMBIO', 'SERVICIO'] as MarketplaceCategory[]).map(
    (c) => ({ value: c, label: getCategoryLabel(c) })
  ),
]

export function MarketplaceListPage() {
  const { slug } = useParams<{ slug: string }>()
  const [category, setCategory] = useState<MarketplaceCategory | ''>('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', slug, { category, page }],
    queryFn: () => marketplaceService.list(slug!, { category: category || undefined, page }),
    enabled: !!slug,
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clasificados</h1>
        <Select
          options={CATEGORIES}
          value={category}
          onChange={(e) => { setCategory(e.target.value as MarketplaceCategory | ''); setPage(1) }}
          className="w-52"
        />
      </div>

      {data?.items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((p) => (
            <Link
              key={p.id}
              to={`/barrios/${slug}/marketplace/${p.id}`}
              className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
            >
              {p.imageUrls?.[0] ? (
                <img src={p.imageUrls[0]} alt={p.title} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
                  <ShoppingBag size={32} className="text-gray-300" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="yellow">{getCategoryLabel(p.category)}</Badge>
                  <span className="text-xs text-gray-400">{formatRelative(p.createdAt)}</span>
                </div>
                <h2 className="font-semibold text-gray-900 group-hover:text-green-700 line-clamp-1 transition-colors">
                  {p.title}
                </h2>
                {p.price && (
                  <p className="text-green-700 font-bold mt-1">
                    {p.currency ?? '$'} {p.price.toLocaleString('es-AR')}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">{p.seller.name}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <ShoppingBag size={40} className="mx-auto mb-3 opacity-50" />
          <p>No hay publicaciones en esta categoría.</p>
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
