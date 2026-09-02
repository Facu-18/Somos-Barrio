import axios from 'axios';
import { Platform } from 'react-native';
import { authStorage } from './auth';

// Use 10.0.2.2 for Android emulator to access localhost on the host machine
const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000/api/v1' : 'http://localhost:4000/api/v1';
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

// Request interceptor: add access token if we have it in memory
api.interceptors.request.use((config) => {
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Response interceptor: Handle 401 and attempt refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401, not a retry yet, and not the login/refresh endpoints
    if (
      error.response?.status === 401 && 
      !originalRequest._retry && 
      !originalRequest.url?.includes('/auth/mobile/login') &&
      !originalRequest.url?.includes('/auth/mobile/refresh')
    ) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await authStorage.getRefreshToken();
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        // Call mobile refresh endpoint
        const refreshResponse = await axios.post(`${getBaseUrl()}/auth/mobile/refresh`, {
          refreshToken
        });
        
        const newAccessToken = refreshResponse.data.data.accessToken;
        const newRefreshToken = refreshResponse.data.data.refreshToken;
        
        setAccessToken(newAccessToken);
        await authStorage.saveRefreshToken(newRefreshToken);
        
        // Update original request auth header
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        
        // Retry original request
        return api(originalRequest);
        
      } catch (refreshError) {
        // Refresh token is invalid or expired
        setAccessToken(null);
        await authStorage.deleteRefreshToken();
        // Here we could dispatch an event or use a global state to force navigation to login
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
