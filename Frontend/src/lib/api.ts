import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
})

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
        accessToken = data.data.accessToken
        original.headers.Authorization = `Bearer ${accessToken}`
        return api(original)
      } catch {
        accessToken = null
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
