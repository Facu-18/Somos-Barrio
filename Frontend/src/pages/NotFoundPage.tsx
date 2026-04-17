import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl font-bold text-gray-200 mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-700 mb-2">Página no encontrada</h1>
        <p className="text-gray-500 mb-6">La página que buscás no existe.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
        >
          <Home size={16} />
          Ir al inicio
        </Link>
      </div>
    </div>
  )
}
