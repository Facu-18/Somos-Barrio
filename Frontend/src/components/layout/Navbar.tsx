import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import {
  Home,
  Newspaper,
  Store,
  ShoppingBag,
  MessageSquare,
  Calendar,
  Mail,
  Search,
  LogOut,
  Menu,
  X,
  User,
  Shield,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { authService } from '../../services/auth.service'
import { cn } from '../../lib/utils'

const NAV = [
  { to: 'news', label: 'Noticias', icon: Newspaper },
  { to: 'businesses', label: 'Comercios', icon: Store },
  { to: 'marketplace', label: 'Clasificados', icon: ShoppingBag },
  { to: 'forum', label: 'Foro', icon: MessageSquare },
  { to: 'events', label: 'Eventos', icon: Calendar },
]

export function Navbar() {
  const { slug } = useParams<{ slug?: string }>()
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    try { await authService.logout() } catch { /* silent */ }
    clearAuth()
    navigate('/login')
  }

  const base = slug ? `/barrios/${slug}` : ''

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-green-700 text-lg shrink-0">
            <Home size={20} />
            <span>Somos Barrio</span>
          </Link>

          {/* Desktop nav */}
          {slug && (
            <div className="hidden md:flex items-center gap-1">
              {NAV.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={`${base}/${to}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  <Icon size={15} />
                  {label}
                </Link>
              ))}
            </div>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Link
              to="/search"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Search size={18} />
            </Link>

            {user ? (
              <>
                <Link
                  to="/messages"
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Mail size={18} />
                </Link>

                {user.role === 'ADMIN' && (
                  <Link
                    to="/admin"
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Admin"
                  >
                    <Shield size={18} />
                  </Link>
                )}

                <div className="relative group">
                  <button className="flex items-center gap-2 p-1.5 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-xs">
                      {user.name[0].toUpperCase()}
                    </div>
                    <span className="hidden sm:block text-sm font-medium">{user.name.split(' ')[0]}</span>
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-xl"
                    >
                      <User size={15} />
                      Mi perfil
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-xl"
                    >
                      <LogOut size={15} />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm font-medium text-green-700 hover:text-green-800 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
              >
                Ingresar
              </Link>
            )}

            {slug && (
              <button
                className="md:hidden p-2 text-gray-500 hover:text-gray-700 rounded-lg"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && slug && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={`${base}/${to}`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
