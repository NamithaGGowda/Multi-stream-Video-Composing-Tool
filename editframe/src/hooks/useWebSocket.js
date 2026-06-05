// ─────────────────────────────────────────────────────────────────────────────
// src/hooks/useWebSocket.js
// React hook that manages the WebSocket connection lifecycle.
// Connects when the user is authenticated, disconnects on logout.
// Pipes WS events into the Zustand editor store.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import {
  wsConnect,
  wsDisconnect,
  wsSubscribeToJob,
  wsUnsubscribeFromJob,
  onWsEvent,
  WS_EVENTS,
} from '../services/ws.service.js';
import { useEditorStore } from '../store/editorStore.js';

// ─── Main connection hook ─────────────────────────────────────────────────────

/**
 * Manages the WebSocket connection for the authenticated session.
 * Call this once at the App level.
 *
 * @param {string|null} accessToken  JWT access token from auth state
 */
export function useWebSocketConnection(accessToken) {
  const handleExportProgress  = useEditorStore((s) => s.handleExportProgress);
  const handleExportComplete  = useEditorStore((s) => s.handleExportComplete);
  const handleExportFailed    = useEditorStore((s) => s.handleExportFailed);

  useEffect(() => {
    if (!accessToken) {
      wsDisconnect();
      return;
    }

    // Connect (or re-auth if already connected)
    wsConnect(accessToken);

    // ── Wire WS events → store actions ────────────────────────────────────

    const unsubs = [
      onWsEvent(WS_EVENTS.EXPORT_PROGRESS, (payload) => {
        handleExportProgress?.(payload);
      }),

      onWsEvent(WS_EVENTS.EXPORT_COMPLETE, (payload) => {
        handleExportComplete?.(payload);
      }),

      onWsEvent(WS_EVENTS.EXPORT_FAILED, (payload) => {
        handleExportFailed?.(payload);
      }),

      onWsEvent(WS_EVENTS.AUTHENTICATED, (payload) => {
        console.log('[WS] Authenticated as user:', payload.userId);
      }),

      onWsEvent(WS_EVENTS.AUTH_ERROR, (payload) => {
        console.warn('[WS] Auth failed:', payload.message);
        wsDisconnect();
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [accessToken]);

  // Disconnect on unmount
  useEffect(() => {
    return () => wsDisconnect();
  }, []);
}

// ─── Job subscription hook ────────────────────────────────────────────────────

/**
 * Subscribe to real-time progress for a specific job while the component
 * is mounted. Automatically unsubscribes on unmount.
 *
 * @param {string|null} jobId
 * @param {object} callbacks
 * @param {function} [callbacks.onProgress]  - Called with { jobId, progress, stage }
 * @param {function} [callbacks.onComplete]  - Called with { jobId, outputUrl, sizeMb }
 * @param {function} [callbacks.onFailed]    - Called with { jobId, error }
 */
export function useJobSubscription(jobId, { onProgress, onComplete, onFailed } = {}) {
  const callbacksRef = useRef({ onProgress, onComplete, onFailed });
  callbacksRef.current = { onProgress, onComplete, onFailed };

  useEffect(() => {
    if (!jobId) return;

    // Subscribe to job room on the server
    wsSubscribeToJob(jobId);

    const unsubs = [];

    if (onProgress || true) {
      unsubs.push(
        onWsEvent(WS_EVENTS.EXPORT_PROGRESS, (payload) => {
          if (payload.jobId === jobId) {
            callbacksRef.current.onProgress?.(payload);
          }
        })
      );
    }

    unsubs.push(
      onWsEvent(WS_EVENTS.EXPORT_COMPLETE, (payload) => {
        if (payload.jobId === jobId) {
          callbacksRef.current.onComplete?.(payload);
        }
      })
    );

    unsubs.push(
      onWsEvent(WS_EVENTS.EXPORT_FAILED, (payload) => {
        if (payload.jobId === jobId) {
          callbacksRef.current.onFailed?.(payload);
        }
      })
    );

    return () => {
      wsUnsubscribeFromJob(jobId);
      unsubs.forEach((unsub) => unsub());
    };
  }, [jobId]);
}

// ─── AI job subscription hook ─────────────────────────────────────────────────

/**
 * Subscribe to real-time updates for an AI job.
 *
 * @param {string|null} jobId
 * @param {object} callbacks
 * @param {function} [callbacks.onProgress]
 * @param {function} [callbacks.onComplete]
 * @param {function} [callbacks.onFailed]
 */
export function useAIJobSubscription(jobId, { onProgress, onComplete, onFailed } = {}) {
  const callbacksRef = useRef({ onProgress, onComplete, onFailed });
  callbacksRef.current = { onProgress, onComplete, onFailed };

  useEffect(() => {
    if (!jobId) return;

    wsSubscribeToJob(jobId);

    const unsubs = [
      onWsEvent(WS_EVENTS.AI_JOB_PROGRESS, (payload) => {
        if (payload.jobId === jobId) callbacksRef.current.onProgress?.(payload);
      }),
      onWsEvent(WS_EVENTS.AI_JOB_COMPLETE, (payload) => {
        if (payload.jobId === jobId) callbacksRef.current.onComplete?.(payload);
      }),
      onWsEvent(WS_EVENTS.AI_JOB_FAILED, (payload) => {
        if (payload.jobId === jobId) callbacksRef.current.onFailed?.(payload);
      }),
    ];

    return () => {
      wsUnsubscribeFromJob(jobId);
      unsubs.forEach((unsub) => unsub());
    };
  }, [jobId]);
}