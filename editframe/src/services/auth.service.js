// ─────────────────────────────────────────────────────────────────────────────
// src/services/auth.service.js
// Auth API calls: register, login, logout, refresh, getMe
// ─────────────────────────────────────────────────────────────────────────────

import api, { setAccessToken, clearAccessToken } from './api.service.js';

/**
 * Register a new user.
 * @param {{ email, password, displayName }} data
 * @returns {Promise<{ user, accessToken }>}
 */
export async function register({ email, password, displayName }) {
  const response = await api.post('/auth/register', { email, password, displayName });
  const { user, accessToken } = response.data.data;
  setAccessToken(accessToken);
  return { user, accessToken };
}

/**
 * Login with email + password.
 * @param {{ email, password }} data
 * @returns {Promise<{ user, accessToken }>}
 */
export async function login({ email, password }) {
  const response = await api.post('/auth/login', { email, password });
  const { user, accessToken } = response.data.data;
  setAccessToken(accessToken);
  return { user, accessToken };
}

/**
 * Logout — revokes the current refresh token.
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    clearAccessToken();
  }
}

/**
 * Refresh the access token using the httpOnly cookie.
 * @returns {Promise<{ user, accessToken } | null>}
 */
export async function refreshToken() {
  try {
    const response = await api.post('/auth/refresh');
    const { user, accessToken } = response.data.data;
    setAccessToken(accessToken);
    return { user, accessToken };
  } catch (_) {
    clearAccessToken();
    return null;
  }
}

/**
 * Get the currently authenticated user.
 * @returns {Promise<object>}
 */
export async function getMe() {
  const response = await api.get('/auth/me');
  return response.data.data.user;
}

/**
 * Revoke all refresh tokens (sign out all devices).
 * @returns {Promise<void>}
 */
export async function revokeAllTokens() {
  await api.delete('/auth/tokens');
  clearAccessToken();
}