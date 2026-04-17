import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import { setAccessToken } from '../lib/api'

interface AuthState {
  user: User | null
  accessToken: string | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, token) => {
        setAccessToken(token)
        set({ user, accessToken: token })
      },
      clearAuth: () => {
        setAccessToken(null)
        set({ user: null, accessToken: null })
      },
    }),
    {
      name: 'sb-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
)
