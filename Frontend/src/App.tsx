import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Layout } from './components/layout/Layout'
import { RequireAuth } from './components/guards/RequireAuth'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { BarrioHomePage } from './pages/BarrioHomePage'
import { NewsListPage } from './pages/news/NewsListPage'
import { NewsDetailPage } from './pages/news/NewsDetailPage'
import { BusinessListPage } from './pages/businesses/BusinessListPage'
import { BusinessDetailPage } from './pages/businesses/BusinessDetailPage'
import { MarketplaceListPage } from './pages/marketplace/MarketplaceListPage'
import { MarketplaceDetailPage } from './pages/marketplace/MarketplaceDetailPage'
import { ForumPage } from './pages/forum/ForumPage'
import { ThreadListPage } from './pages/forum/ThreadListPage'
import { ThreadDetailPage } from './pages/forum/ThreadDetailPage'
import { EventsListPage } from './pages/events/EventsListPage'
import { EventDetailPage } from './pages/events/EventDetailPage'
import { MessagesPage } from './pages/MessagesPage'
import { SearchPage } from './pages/SearchPage'
import { ProfilePage } from './pages/ProfilePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { useAuthStore } from './store/auth'
import { authService } from './services/auth.service'
import { setAccessToken } from './lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60,
    },
  },
})

function AuthInit({ children }: { children: React.ReactNode }) {
  const { user, setAuth, clearAuth } = useAuthStore()

  useEffect(() => {
    if (user) {
      authService.refresh()
        .then((data) => setAuth(data.user, data.accessToken))
        .catch(() => clearAuth())
    }
  }, [])

  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthInit>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route
              path="/"
              element={
                <Layout>
                  <HomePage />
                </Layout>
              }
            />

            <Route
              path="/search"
              element={
                <Layout>
                  <SearchPage />
                </Layout>
              }
            />

            <Route
              path="/messages"
              element={
                <Layout>
                  <RequireAuth>
                    <MessagesPage />
                  </RequireAuth>
                </Layout>
              }
            />

            <Route
              path="/profile"
              element={
                <Layout>
                  <RequireAuth>
                    <ProfilePage />
                  </RequireAuth>
                </Layout>
              }
            />

            {/* Barrio routes */}
            <Route path="/barrios/:slug" element={<Layout><BarrioHomePage /></Layout>} />
            <Route path="/barrios/:slug/news" element={<Layout><NewsListPage /></Layout>} />
            <Route path="/barrios/:slug/news/:newsSlug" element={<Layout><NewsDetailPage /></Layout>} />
            <Route path="/barrios/:slug/businesses" element={<Layout><BusinessListPage /></Layout>} />
            <Route path="/barrios/:slug/businesses/:businessSlug" element={<Layout><BusinessDetailPage /></Layout>} />
            <Route path="/barrios/:slug/marketplace" element={<Layout><MarketplaceListPage /></Layout>} />
            <Route path="/barrios/:slug/marketplace/:postId" element={<Layout><MarketplaceDetailPage /></Layout>} />
            <Route path="/barrios/:slug/forum" element={<Layout><ForumPage /></Layout>} />
            <Route path="/barrios/:slug/forum/:subforumSlug" element={<Layout><ThreadListPage /></Layout>} />
            <Route path="/barrios/:slug/forum/:subforumSlug/:threadId" element={<Layout><ThreadDetailPage /></Layout>} />
            <Route path="/barrios/:slug/events" element={<Layout><EventsListPage /></Layout>} />
            <Route path="/barrios/:slug/events/:eventId" element={<Layout><EventDetailPage /></Layout>} />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthInit>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
