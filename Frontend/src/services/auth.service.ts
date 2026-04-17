import { api } from '../lib/api'
import type { ApiResponse, User } from '../types'

export interface LoginInput { email: string; password: string }
export interface RegisterInput { email: string; password: string; name: string; barrioSlug?: string }
export interface AuthData { accessToken: string; user: User }

export const authService = {
  login: (data: LoginInput) =>
    api.post<ApiResponse<AuthData>>('/auth/login', data).then((r) => r.data.data),

  register: (data: RegisterInput) =>
    api.post<ApiResponse<AuthData>>('/auth/register', data).then((r) => r.data.data),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<ApiResponse<User>>('/auth/me').then((r) => r.data.data),

  refresh: () =>
    api.post<ApiResponse<AuthData>>('/auth/refresh').then((r) => r.data.data),
}
