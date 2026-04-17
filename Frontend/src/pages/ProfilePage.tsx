import { useAuthStore } from '../store/auth'
import { Badge } from '../components/ui/Badge'
import { formatDate } from '../lib/utils'

const ROLE_LABELS: Record<string, string> = {
  VECINO: 'Vecino',
  NEGOCIO: 'Negocio',
  EDITOR: 'Editor',
  ADMIN: 'Administrador',
}

export function ProfilePage() {
  const { user } = useAuthStore()

  if (!user) return null

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi perfil</h1>

      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-2xl font-bold">
            {user.name[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
            <div className="mt-1">
              <Badge variant="green">{ROLE_LABELS[user.role] ?? user.role}</Badge>
            </div>
          </div>
        </div>

        {user.bio && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-600 mb-1">Bio</p>
            <p className="text-sm text-gray-700">{user.bio}</p>
          </div>
        )}

        {user.barrio && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-600 mb-1">Barrio</p>
            <p className="text-sm text-gray-700">{user.barrio.name}</p>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">Miembro desde</p>
          <p className="text-sm text-gray-700">{formatDate(user.createdAt)}</p>
        </div>
      </div>
    </div>
  )
}
