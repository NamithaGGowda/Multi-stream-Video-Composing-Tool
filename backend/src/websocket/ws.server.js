// ─────────────────────────────────────────────────────────────────────────────
// src/websocket/ws.server.js
// Native ws WebSocket server.
// Handles client authentication, heartbeat, and message routing.
// Workers call broadcastToUser() / broadcastToJob() to push progress updates.
// ─────────────────────────────────────────────────────────────────────────────

import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccessToken } from '../utils/jwt.utils.js';
import prisma from '../config/db.js';
import { addClient, removeClient, getRoomClients } from './ws.rooms.js';

let wss = null;

// ─── Message type constants ───────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Send a typed JSON message to a single WebSocket client.
 * Silently drops if the socket is not OPEN.
 *
 * @param {WebSocket} socket
 * @param {string}    type
 * @param {object}    [payload]
 */
export function sendToSocket(socket, type, payload = {}) {
  if (socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify({ type, payload, ts: Date.now() }));
  } catch (_) {
    // noop — socket may have closed between the readyState check and send
  }
}

/**
 * Broadcast a message to ALL connected sockets for a given userId.
 *
 * @param {string} userId
 * @param {string} type
 * @param {object} [payload]
 */
export function broadcastToUser(userId, type, payload = {}) {
  const clients = getRoomClients(`user:${userId}`);
  for (const socket of clients) {
    sendToSocket(socket, type, payload);
  }
}

/**
 * Broadcast a message to all clients subscribed to a specific job room.
 * Room key format: 'job:{jobId}'
 *
 * @param {string} jobId
 * @param {string} type
 * @param {object} [payload]
 */
export function broadcastToJob(jobId, type, payload = {}) {
  // Always also broadcast to the user room (job owner sees progress wherever they are)
  const jobClients  = getRoomClients(`job:${jobId}`);
  for (const socket of jobClients) {
    sendToSocket(socket, type, payload);
  }
}

// ─── Authentication ───────────────────────────────────────────────────────────

/**
 * Authenticate a WebSocket connection using a JWT access token.
 * Token can be provided in:
 *   1. Query param:  ws://host/?token=<jwt>
 *   2. Auth message: { type: 'auth', payload: { token: '<jwt>' } }
 *
 * @param {string} token
 * @returns {Promise<object|null>}  Prisma User or null
 */
async function authenticateToken(token) {
  if (!token) return null;

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (_) {
    return null;
  }

  if (decoded.type !== 'access') return null;

  return prisma.user.findUnique({
    where:  { id: decoded.sub },
    select: { id: true, email: true, plan: true, displayName: true },
  });
}

// ─── Message handler ──────────────────────────────────────────────────────────

/**
 * Handle an incoming parsed message from a connected, authenticated client.
 *
 * @param {WebSocket} socket
 * @param {object}    message   - Parsed JSON from client
 */
function handleMessage(socket, message) {
  const { type, payload = {} } = message;

  switch (type) {
    // Client subscribes to progress updates for a specific job
    case WS_EVENTS.SUBSCRIBE: {
      const { jobId } = payload;
      if (jobId && typeof jobId === 'string') {
        addClient(`job:${jobId}`, socket);
        console.log(`[WS] Client ${socket._userId} subscribed to job:${jobId}`);
      }
      break;
    }

    // Client unsubscribes from a job room
    case WS_EVENTS.UNSUBSCRIBE: {
      const { jobId } = payload;
      if (jobId) {
        removeClient(`job:${jobId}`, socket);
      }
      break;
    }

    // Respond to client ping
    case WS_EVENTS.PING: {
      sendToSocket(socket, WS_EVENTS.PONG, { ts: Date.now() });
      break;
    }

    default:
      sendToSocket(socket, WS_EVENTS.ERROR, { message: `Unknown message type: ${type}` });
  }
}

// ─── Server initialisation ────────────────────────────────────────────────────

/**
 * Attach a ws WebSocket server to an existing HTTP server.
 * Called once during bootstrap in server.js.
 *
 * @param {import('http').Server} httpServer
 */
export function initWsServer(httpServer) {
  wss = new WebSocketServer({
    server:    httpServer,
    path:      '/ws',
    // Limit message size to 64 KB (clients only send small control messages)
    maxPayload: 64 * 1024,
  });

  const HEARTBEAT_INTERVAL = parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10);
  const CLIENT_TIMEOUT     = parseInt(process.env.WS_CLIENT_TIMEOUT     || '60000', 10);

  // ── Heartbeat interval: ping all clients, remove dead ones ─────────────────
  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (!socket._isAlive) {
        // Client didn't respond to last ping — terminate
        console.log(`[WS] Terminating dead client (userId: ${socket._userId || 'unauthenticated'})`);
        removeClient(`user:${socket._userId}`, socket);
        socket.terminate();
        return;
      }
      socket._isAlive = false;
      sendToSocket(socket, WS_EVENTS.PING, {});
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => clearInterval(heartbeatTimer));

  // ── Connection handler ──────────────────────────────────────────────────────
  wss.on('connection', async (socket, request) => {
    socket._isAlive    = true;
    socket._userId     = null;
    socket._authenticated = false;

    console.log(`[WS] New connection from ${request.socket.remoteAddress}`);

    // Send initial connected message
    sendToSocket(socket, WS_EVENTS.CONNECTED, {
      message: 'Connected to EditFrame WS. Send { type: "auth", payload: { token } } to authenticate.',
    });

    // ── Try to authenticate via query param immediately ─────────────────────
    const url           = new URL(request.url, `http://${request.headers.host}`);
    const queryToken    = url.searchParams.get('token');

    if (queryToken) {
      const user = await authenticateToken(queryToken);
      if (user) {
        socket._userId        = user.id;
        socket._authenticated = true;
        addClient(`user:${user.id}`, socket);
        sendToSocket(socket, WS_EVENTS.AUTHENTICATED, {
          userId: user.id,
          displayName: user.displayName,
        });
        console.log(`[WS] Client authenticated via query param: ${user.id}`);
      } else {
        sendToSocket(socket, WS_EVENTS.AUTH_ERROR, { message: 'Invalid or expired token' });
      }
    }

    // ── Set auth timeout for unauthenticated clients ─────────────────────────
    const authTimeout = setTimeout(() => {
      if (!socket._authenticated) {
        console.log('[WS] Closing unauthenticated client after timeout');
        sendToSocket(socket, WS_EVENTS.AUTH_ERROR, {
          message: 'Authentication timeout. Please reconnect and send an auth message.',
        });
        socket.close(1008, 'Authentication timeout');
      }
    }, CLIENT_TIMEOUT);

    // ── Message handler ──────────────────────────────────────────────────────
    socket.on('message', async (raw) => {
      // Mark as alive on any message
      socket._isAlive = true;

      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch (_) {
        sendToSocket(socket, WS_EVENTS.ERROR, { message: 'Invalid JSON' });
        return;
      }

      // Handle auth message from client (for clients that don't use query param)
      if (message.type === WS_EVENTS.AUTH) {
        if (socket._authenticated) {
          sendToSocket(socket, WS_EVENTS.AUTHENTICATED, { userId: socket._userId });
          return;
        }

        const user = await authenticateToken(message.payload?.token);
        if (user) {
          clearTimeout(authTimeout);
          socket._userId        = user.id;
          socket._authenticated = true;
          addClient(`user:${user.id}`, socket);
          sendToSocket(socket, WS_EVENTS.AUTHENTICATED, {
            userId:      user.id,
            displayName: user.displayName,
          });
          console.log(`[WS] Client authenticated via message: ${user.id}`);
        } else {
          sendToSocket(socket, WS_EVENTS.AUTH_ERROR, { message: 'Invalid or expired token' });
        }
        return;
      }

      // All other messages require authentication
      if (!socket._authenticated) {
        sendToSocket(socket, WS_EVENTS.AUTH_ERROR, {
          message: 'Not authenticated. Send { type: "auth", payload: { token } } first.',
        });
        return;
      }

      // Route to message handler
      handleMessage(socket, message);
    });

    // ── Pong handler (response to server ping) ───────────────────────────────
    socket.on('pong', () => {
      socket._isAlive = true;
    });

    // ── Disconnect handler ───────────────────────────────────────────────────
    socket.on('close', (code, reason) => {
      clearTimeout(authTimeout);
      if (socket._userId) {
        removeClient(`user:${socket._userId}`, socket);
      }
      console.log(`[WS] Client disconnected (userId: ${socket._userId || 'anon'}, code: ${code})`);
    });

    // ── Error handler ────────────────────────────────────────────────────────
    socket.on('error', (err) => {
      console.error(`[WS] Socket error (userId: ${socket._userId || 'anon'}):`, err.message);
    });
  });

  wss.on('error', (err) => {
    console.error('[WS] Server error:', err.message);
  });

  console.log(`[WS] WebSocket server initialised at path /ws`);
  return wss;
}

/**
 * Get the ws server instance (for testing / admin routes).
 * @returns {WebSocketServer|null}
 */
export function getWsServer() {
  return wss;
}