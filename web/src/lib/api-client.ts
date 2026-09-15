import axios, { AxiosError } from "axios";

type RetryableRequest = NonNullable<AxiosError["config"]> & { _retry?: boolean };

export const apiClient = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
});

let currentAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  currentAccessToken = token;
};

export const getAccessToken = () => currentAccessToken;

apiClient.interceptors.request.use((config) => {
  if (currentAccessToken) {
    config.headers.Authorization = `Bearer ${currentAccessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;
    // If we receive a 401 and we haven't already retried this request
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Attempt to refresh token using the cookie
        const res = await axios.post(
          "/api/v1/auth/refresh",
          {},
          { withCredentials: true }
        );
        if (res.data.success && res.data.data.accessToken) {
          setAccessToken(res.data.data.accessToken);
          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${currentAccessToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        // Refresh failed, user needs to login again
        setAccessToken(null);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("auth:expired"));
        }
      }
    }
    return Promise.reject(error);
  }
);
