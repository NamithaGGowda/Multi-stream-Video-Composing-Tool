// ─────────────────────────────────────────────────────────────────────────────
// src/hooks/useAuth.js
// Auth state management hook.
// Handles login, register, logout, and auto-refresh on app load.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as authService from '../services/auth.service.js';
import { useEditorStore } from '../store/editorStore.js';
import { wsConnect, wsDisconnect } from '../services/ws.service.js';

export function useAuth() {
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true); // true on first load
  const [submitting, setSubmitting] = useState(false);

  const setAccessToken = useEditorStore((s) => s.setAccessToken);

  // ── Auto-refresh on app load ───────────────────────────────────────────────
  // Try to restore the session from the httpOnly refresh cookie
  useEffect(() => {
    async function restoreSession() {
      try {
        const result = await authService.refreshToken();
        if (result) {
          setUser(result.user);
          setAccessToken(result.accessToken);
          wsConnect(result.accessToken);
        }
      } catch (_) {
        // No valid session — user needs to log in
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  // ── Listen for forced logout (token refresh failed) ────────────────────────
  useEffect(() => {
    const handleForcedLogout = () => {
      setUser(null);
      setAccessToken(null);
      wsDisconnect();
      toast.error('Your session expired. Please log in again.');
    };

    window.addEventListener('auth:logout', handleForcedLogout);
    return () => window.removeEventListener('auth:logout', handleForcedLogout);
  }, []);

  // ── Register ───────────────────────────────────────────────────────────────
  const register = useCallback(async ({ email, password, displayName }) => {
    setSubmitting(true);
    try {
      const result = await authService.register({ email, password, displayName });
      setUser(result.user);
      setAccessToken(result.accessToken);
      wsConnect(result.accessToken);
      toast.success(`Welcome to EditFrame, ${result.user.displayName}!`);
      return result;
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      toast.error(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    setSubmitting(true);
    try {
      const result = await authService.login({ email, password });
      setUser(result.user);
      setAccessToken(result.accessToken);
      wsConnect(result.accessToken);
      toast.success(`Welcome back, ${result.user.displayName}!`);
      return result;
    } catch (err) {
      const message = err.response?.data?.message || 'Invalid email or password';
      toast.error(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setAccessToken(null);
      wsDisconnect();
      toast.success('Logged out successfully');
    }
  }, []);

  return {
    user,
    loading,
    submitting,
    isAuthenticated: !!user,
    register,
    login,
    logout,
  };
}