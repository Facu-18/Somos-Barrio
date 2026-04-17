import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, ArrowRight } from 'lucide-react'
import { barriosService } from '../services/barrios.service'
import { Spinner } from '../components/ui/Spinner'

export function HomePage() {
  const { data: barrios, isLoading } = useQuery({
    queryKey: ['barrios'],
    queryFn: barriosService.list,
  })

  if (isLoading) return <Spinner />

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Bienvenido a <span className="text-green-700">Somos Barrio</span>
        </h1>
        <p className="text-gray-500 text-lg">
          Tu revista digital de barrio. Elegí tu barrio para ver noticias, comercios, eventos y más.
        </p>
      </div>

      {barrios && barrios.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {barrios.map((barrio) => (
            <Link
              key={barrio.slug}
              to={`/barrios/${barrio.slug}`}
              className="group bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-green-300 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin size={16} className="text-green-600" />
                    <h2 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors">
                      {barrio.name}
                    </h2>
                  </div>
                  <p className="text-sm text-gray-500">
                    {barrio.city}, {barrio.province}
                  </p>
                  {barrio.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{barrio.description}</p>
                  )}
                </div>
                <ArrowRight
                  size={18}
                  className="text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all mt-1 shrink-0"
                />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <MapPin size={40} className="mx-auto mb-3 opacity-50" />
          <p>Todavía no hay barrios registrados.</p>
        </div>
      )}
    </div>
  )
}
