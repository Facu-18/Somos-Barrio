import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Calendar, MapPin, Users } from 'lucide-react'
import { eventsService } from '../../services/events.service'
import { Spinner } from '../../components/ui/Spinner'
import { formatDate } from '../../lib/utils'

export function EventsListPage() {
  const { slug } = useParams<{ slug: string }>()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['events', slug, page],
    queryFn: () => eventsService.list(slug!, { page }),
    enabled: !!slug,
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Eventos</h1>

      {data?.items.length ? (
        <div className="flex flex-col gap-4">
          {data.items.map((e) => (
            <Link
              key={e.id}
              to={`/barrios/${slug}/events/${e.id}`}
              className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4 p-4">
                {e.imageUrl && (
                  <img src={e.imageUrl} alt={e.title} className="w-24 h-20 object-cover rounded-lg shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors mb-1">
                    {e.title}
                  </h2>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-2">{e.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(e.startDate)}
                    </span>
                    {e.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {e.location}
                      </span>
                    )}
                    {e._count?.rsvps !== undefined && (
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {e._count.rsvps} confirmados
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-50" />
          <p>No hay eventos próximos.</p>
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
