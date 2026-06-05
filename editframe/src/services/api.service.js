// ─────────────────────────────────────────────────────────────────────────────
// src/services/api.service.js
// Base Axios instance with interceptors for:
//   - Attaching JWT access token to every request
//   - Auto-refreshing expired tokens via refresh cookie
//   - Redirecting to login on 401 after refresh fails
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// ─── Axios instance ───────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL:         BASE_URL,
  withCredentials: true,  // send httpOnly refresh token cookie
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// ─── Token storage (in-memory — never localStorage) ──────────────────────────

let accessToken = null;
let isRefreshing = false;
let refreshQueue = [];

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

// ─── Request interceptor — attach access token ────────────────────────────────

api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor — handle 401, refresh token ────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401 and only once per request
    if (
      error.response?.status === 401 &&
      !originalRequest._retried &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        });
      }

      originalRequest._retried = true;
      isRefreshing = true;

      try {
        // Try to get a new access token using the httpOnly refresh cookie
        const response = await api.post('/auth/refresh');
        const newToken = response.data?.data?.accessToken;

        if (newToken) {
          setAccessToken(newToken);

          // Flush queued requests
          refreshQueue.forEach(({ resolve }) => resolve(newToken));
          refreshQueue = [];

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (_) {
        // Refresh failed — clear token and redirect to login
        refreshQueue.forEach(({ reject }) => reject(error));
        refreshQueue = [];
        clearAccessToken();

        // Dispatch logout event so the app can redirect to login
        window.dispatchEvent(new CustomEvent('auth:logout'));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Helper to extract error message ─────────────────────────────────────────

/**
 * Extract a human-readable error message from an Axios error.
 * @param {Error} error
 * @returns {string}
 */
export function getErrorMessage(error) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.response?.data?.errors?.[0]?.message) return error.response.data.errors[0].message;
  if (error.message) return error.message;
  return 'An unexpected error occurred';
}

export default api;