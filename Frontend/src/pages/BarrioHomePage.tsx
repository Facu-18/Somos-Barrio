import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Newspaper, Store, ShoppingBag, MessageSquare, Calendar } from 'lucide-react'
import { barriosService } from '../services/barrios.service'
import { newsService } from '../services/news.service'
import { eventsService } from '../services/events.service'
import { Spinner } from '../components/ui/Spinner'
import { formatDate, formatRelative } from '../lib/utils'
import { Card } from '../components/ui/Card'

const SECTIONS = [
  { to: 'news', label: 'Noticias', icon: Newspaper, color: 'text-blue-600 bg-blue-50' },
  { to: 'businesses', label: 'Comercios', icon: Store, color: 'text-green-600 bg-green-50' },
  { to: 'marketplace', label: 'Clasificados', icon: ShoppingBag, color: 'text-yellow-600 bg-yellow-50' },
  { to: 'forum', label: 'Foro', icon: MessageSquare, color: 'text-purple-600 bg-purple-50' },
  { to: 'events', label: 'Eventos', icon: Calendar, color: 'text-red-600 bg-red-50' },
]

export function BarrioHomePage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: barrio, isLoading: barrioLoading } = useQuery({
    queryKey: ['barrio', slug],
    queryFn: () => barriosService.get(slug!),
    enabled: !!slug,
  })

  const { data: newsData } = useQuery({
    queryKey: ['news', slug, { limit: 3 }],
    queryFn: () => newsService.list(slug!, { limit: 3 }),
    enabled: !!slug,
  })

  const { data: eventsData } = useQuery({
    queryKey: ['events', slug, { limit: 3 }],
    queryFn: () => eventsService.list(slug!, { limit: 3 }),
    enabled: !!slug,
  })

  if (barrioLoading) return <Spinner />
  if (!barrio) return <p className="text-center text-gray-500">Barrio no encontrado</p>

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{barrio.name}</h1>
        <p className="text-gray-500 text-sm mt-1">{barrio.city}, {barrio.province}</p>
        {barrio.description && <p className="text-gray-600 mt-2">{barrio.description}</p>}
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {SECTIONS.map(({ to, label, icon: Icon, color }) => (
          <Link
            key={to}
            to={`/barrios/${slug}/${to}`}
            className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-gray-300 transition-all text-center"
          >
            <div className={`p-2 rounded-lg ${color}`}>
              <Icon size={20} />
            </div>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Latest news */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Newspaper size={16} className="text-blue-600" />
              Últimas noticias
            </h2>
            <Link to={`/barrios/${slug}/news`} className="text-sm text-green-700 hover:underline">
              Ver todas
            </Link>
          </div>

          {newsData?.items.length ? (
            <div className="flex flex-col gap-3">
              {newsData.items.map((n) => (
                <Link
                  key={n.id}
                  to={`/barrios/${slug}/news/${n.slug}`}
                  className="group block"
                >
                  <p className="text-sm font-medium text-gray-800 group-hover:text-green-700 line-clamp-2">
                    {n.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatRelative(n.createdAt)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No hay noticias aún</p>
          )}
        </Card>

        {/* Upcoming events */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar size={16} className="text-red-600" />
              Próximos eventos
            </h2>
            <Link to={`/barrios/${slug}/events`} className="text-sm text-green-700 hover:underline">
              Ver todos
            </Link>
          </div>

          {eventsData?.items.length ? (
            <div className="flex flex-col gap-3">
              {eventsData.items.map((e) => (
                <Link
                  key={e.id}
                  to={`/barrios/${slug}/events/${e.id}`}
                  className="group block"
                >
                  <p className="text-sm font-medium text-gray-800 group-hover:text-green-700 line-clamp-1">
                    {e.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(e.startDate)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No hay eventos próximos</p>
          )}
        </Card>
      </div>
    </div>
  )
}
