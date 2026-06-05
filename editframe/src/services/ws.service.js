// ─────────────────────────────────────────────────────────────────────────────
// src/services/ws.service.js
// Singleton WebSocket client for EditFrame.
// Handles connection, authentication, auto-reconnect, heartbeat,
// and event dispatching to registered listeners.
// ─────────────────────────────────────────────────────────────────────────────

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';

// How long to wait before reconnecting (ms), doubles each attempt up to max
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY  = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;

// ─── Event types (must match backend WS_EVENTS) ───────────────────────────────

export const WS_EVENTS = {
  // Sent by server
  CONNECTED:        'connected',
  AUTHENTICATED:    'authenticated',
  AUTH_ERROR:       'auth_error',
  EXPORT_PROGRESS:  'export_progress',
  EXPORT_COMPLETE:  'export_complete',
  EXPORT_FAILED:    'export_failed',
  VIDEO_JOB_DONE:   'video_job_done',
  VIDEO_JOB_FAILED: 'video_job_failed',
  AI_JOB_PROGRESS:  'ai_job_progress',
  AI_JOB_COMPLETE:  'ai_job_complete',
  AI_JOB_FAILED:    'ai_job_failed',
  PING:             'ping',
  PONG:             'pong',
  ERROR:            'error',
  // Sent by client
  AUTH:             'auth',
  SUBSCRIBE:        'subscribe',
  UNSUBSCRIBE:      'unsubscribe',
};

// ─── Singleton state ──────────────────────────────────────────────────────────

let socket            = null;
let accessToken       = null;
let reconnectAttempts = 0;
let reconnectTimer    = null;
let isIntentionallyClosed = false;
let pingInterval      = null;

// Map of event type → Set of listener functions
const listeners = new Map();

// ─── Event emitter helpers ────────────────────────────────────────────────────

/**
 * Register a listener for a specific WS event type.
 * Returns an unsubscribe function.
 *
 * @param {string}   eventType
 * @param {function} listener
 * @returns {function}  Call to remove the listener
 */
export function onWsEvent(eventType, listener) {
  if (!listeners.has(eventType)) {
    listeners.set(eventType, new Set());
  }
  listeners.get(eventType).add(listener);

  // Return unsubscribe function
  return () => {
    listeners.get(eventType)?.delete(listener);
  };
}

/**
 * Dispatch a received event to all registered listeners.
 * @param {string} eventType
 * @param {object} payload
 */
function dispatch(eventType, payload) {
  const eventListeners = listeners.get(eventType);
  if (!eventListeners) return;
  for (const listener of eventListeners) {
    try {
      listener(payload);
    } catch (err) {
      console.error(`[WS] Listener error for ${eventType}:`, err);
    }
  }
  // Also dispatch to '*' wildcard listeners
  const wildcardListeners = listeners.get('*');
  if (wildcardListeners) {
    for (const listener of wildcardListeners) {
      try {
        listener({ type: eventType, payload });
      } catch (_) {}
    }
  }
}

// ─── Send helpers ─────────────────────────────────────────────────────────────

/**
 * Send a typed JSON message to the server.
 * Silently drops if the socket is not open.
 *
 * @param {string} type
 * @param {object} [payload]
 */
export function wsSend(type, payload = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify({ type, payload }));
  } catch (_) {}
}

/**
 * Subscribe to real-time progress updates for a specific job.
 * @param {string} jobId
 */
export function wsSubscribeToJob(jobId) {
  wsSend(WS_EVENTS.SUBSCRIBE, { jobId });
}

/**
 * Unsubscribe from a job room.
 * @param {string} jobId
 */
export function wsUnsubscribeFromJob(jobId) {
  wsSend(WS_EVENTS.UNSUBSCRIBE, { jobId });
}

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Connect to the WebSocket server and authenticate.
 * If already connected, just updates the token.
 *
 * @param {string} token  JWT access token
 */
export function wsConnect(token) {
  accessToken           = token;
  isIntentionallyClosed = false;

  // If already open, just re-authenticate with new token
  if (socket && socket.readyState === WebSocket.OPEN) {
    wsSend(WS_EVENTS.AUTH, { token });
    return;
  }

  // Close any existing socket that's connecting/closing
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }

  _openSocket();
}

/**
 * Disconnect cleanly. Will not auto-reconnect.
 */
export function wsDisconnect() {
  isIntentionallyClosed = true;
  clearTimeout(reconnectTimer);
  clearInterval(pingInterval);
  reconnectAttempts = 0;

  if (socket) {
    socket.onclose = null;
    socket.close(1000, 'Intentional disconnect');
    socket = null;
  }

  console.log('[WS] Disconnected');
}

/**
 * Returns true if the socket is currently open and authenticated.
 * @returns {boolean}
 */
export function wsIsConnected() {
  return socket?.readyState === WebSocket.OPEN;
}

// ─── Internal socket management ───────────────────────────────────────────────

function _openSocket() {
  // Pass token as query param for immediate auth on connect
  const url = accessToken
    ? `${WS_URL}?token=${encodeURIComponent(accessToken)}`
    : WS_URL;

  console.log(`[WS] Connecting to ${WS_URL}…`);

  try {
    socket = new WebSocket(url);
  } catch (err) {
    console.error('[WS] Failed to create WebSocket:', err.message);
    _scheduleReconnect();
    return;
  }

  // ── Open ──────────────────────────────────────────────────────────────────
  socket.onopen = () => {
    console.log('[WS] Connection established');
    reconnectAttempts = 0;

    // Start client-side ping to keep connection alive
    clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      wsSend(WS_EVENTS.PING);
    }, 25000);

    dispatch('ws_connected', {});
  };

  // ── Message ───────────────────────────────────────────────────────────────
  socket.onmessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (_) {
      return;
    }

    const { type, payload = {} } = message;

    // Handle pong (response to our ping) — just keeps connection alive
    if (type === WS_EVENTS.PONG) return;

    // Respond to server ping
    if (type === WS_EVENTS.PING) {
      wsSend(WS_EVENTS.PONG);
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[WS] ← ${type}`, payload);
    }

    dispatch(type, payload);
  };

  // ── Close ─────────────────────────────────────────────────────────────────
  socket.onclose = (event) => {
    clearInterval(pingInterval);
    socket = null;

    if (isIntentionallyClosed) return;

    console.warn(`[WS] Connection closed (code: ${event.code}). Reconnecting…`);
    dispatch('ws_disconnected', { code: event.code });
    _scheduleReconnect();
  };

  // ── Error ─────────────────────────────────────────────────────────────────
  socket.onerror = (err) => {
    console.warn('[WS] Connection error — is the backend running on port 4000?');
    dispatch('ws_error', { message: 'Connection error' });
    // onclose will fire next and handle reconnect
  };
}

function _scheduleReconnect() {
  if (isIntentionallyClosed) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('[WS] Max reconnection attempts reached. Give up.');
    dispatch('ws_max_retries', {});
    return;
  }

  const delay = Math.min(
    RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts),
    RECONNECT_MAX_DELAY
  );

  reconnectAttempts++;
  console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})…`);

  reconnectTimer = setTimeout(() => {
    if (!isIntentionallyClosed && accessToken) {
      _openSocket();
    }
  }, delay);
}