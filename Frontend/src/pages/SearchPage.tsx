import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Newspaper, Store, ShoppingBag, MessageSquare } from 'lucide-react'
import { searchService } from '../services/search.service'
import { Spinner } from '../components/ui/Spinner'
import { Input } from '../components/ui/Input'

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') ?? '')

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: () => searchService.search(q),
    enabled: q.length >= 2,
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchParams(q ? { q } : {})
  }

  const hasResults = data && (
    data.news.length + data.businesses.length + data.marketplace.length + data.forum.length > 0
  )

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Buscar</h1>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <div className="flex-1">
          <Input
            placeholder="Buscar noticias, comercios, publicaciones..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
        >
          <Search size={18} />
        </button>
      </form>

      {isLoading || isFetching ? (
        <Spinner />
      ) : q.length >= 2 ? (
        hasResults ? (
          <div className="flex flex-col gap-8">
            {data.news.length > 0 && (
              <section>
                <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
                  <Newspaper size={16} className="text-blue-600" />
                  Noticias ({data.news.length})
                </h2>
                <div className="flex flex-col gap-2">
                  {data.news.map((n) => (
                    <Link
                      key={n.id}
                      to={`/barrios/${n.barrio.slug}/news/${n.slug}`}
                      className="bg-white border border-gray-200 rounded-lg px-4 py-3 hover:shadow-sm hover:border-gray-300 transition"
                    >
                      <p className="text-sm font-medium text-gray-900 hover:text-green-700">{n.title}</p>
                      {n.summary && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{n.summary}</p>}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {data.businesses.length > 0 && (
              <section>
                <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
                  <Store size={16} className="text-green-600" />
                  Comercios ({data.businesses.length})
                </h2>
                <div className="flex flex-col gap-2">
                  {data.businesses.map((b) => (
                    <Link
                      key={b.id}
                      to={`/barrios/${b.barrio.slug}/businesses/${b.slug}`}
                      className="bg-white border border-gray-200 rounded-lg px-4 py-3 hover:shadow-sm hover:border-gray-300 transition"
                    >
                      <p className="text-sm font-medium text-gray-900 hover:text-green-700">{b.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{b.address}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {data.marketplace.length > 0 && (
              <section>
                <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
                  <ShoppingBag size={16} className="text-yellow-600" />
                  Clasificados ({data.marketplace.length})
                </h2>
                <div className="flex flex-col gap-2">
                  {data.marketplace.map((p) => (
                    <Link
                      key={p.id}
                      to={`/barrios/${p.barrio.slug}/marketplace/${p.id}`}
                      className="bg-white border border-gray-200 rounded-lg px-4 py-3 hover:shadow-sm hover:border-gray-300 transition"
                    >
                      <p className="text-sm font-medium text-gray-900 hover:text-green-700">{p.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {data.forum.length > 0 && (
              <section>
                <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
                  <MessageSquare size={16} className="text-purple-600" />
                  Foro ({data.forum.length})
                </h2>
                <div className="flex flex-col gap-2">
                  {data.forum.map((t) => (
                    <Link
                      key={t.id}
                      to={`/barrios/${t.subforum?.slug ?? ''}/forum/${t.subforum?.slug}/${t.id}`}
                      className="bg-white border border-gray-200 rounded-lg px-4 py-3 hover:shadow-sm hover:border-gray-300 transition"
                    >
                      <p className="text-sm font-medium text-gray-900 hover:text-green-700">{t.title}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <Search size={40} className="mx-auto mb-3 opacity-50" />
            <p>No se encontraron resultados para "<strong>{q}</strong>"</p>
          </div>
        )
      ) : (
        <div className="text-center py-16 text-gray-300">
          <Search size={48} className="mx-auto mb-3" />
          <p className="text-gray-400">Escribí al menos 2 caracteres para buscar</p>
        </div>
      )}
    </div>
  )
}
