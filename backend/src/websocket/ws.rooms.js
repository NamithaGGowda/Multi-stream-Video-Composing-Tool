// ─────────────────────────────────────────────────────────────────────────────
// src/websocket/ws.rooms.js
// In-memory room registry for WebSocket clients.
// Rooms are identified by a string key (e.g. 'user:uuid', 'job:uuid').
// Each room holds a Set of WebSocket socket references.
// ─────────────────────────────────────────────────────────────────────────────

import { WebSocket } from 'ws';

/**
 * Map of room key → Set<WebSocket>
 * @type {Map<string, Set<WebSocket>>}
 */
const rooms = new Map();

/**
 * Add a socket to a room.
 * Creates the room if it doesn't exist.
 *
 * @param {string}    roomKey  - e.g. 'user:abc123' or 'job:xyz789'
 * @param {WebSocket} socket
 */
export function addClient(roomKey, socket) {
  if (!rooms.has(roomKey)) {
    rooms.set(roomKey, new Set());
  }
  rooms.get(roomKey).add(socket);
}

/**
 * Remove a socket from a room.
 * Deletes the room entry if it becomes empty.
 *
 * @param {string}    roomKey
 * @param {WebSocket} socket
 */
export function removeClient(roomKey, socket) {
  const room = rooms.get(roomKey);
  if (!room) return;

  room.delete(socket);

  if (room.size === 0) {
    rooms.delete(roomKey);
  }
}

/**
 * Remove a socket from ALL rooms it is currently in.
 * Called on disconnect to prevent memory leaks.
 *
 * @param {WebSocket} socket
 */
export function removeClientFromAllRooms(socket) {
  for (const [key, room] of rooms.entries()) {
    room.delete(socket);
    if (room.size === 0) {
      rooms.delete(key);
    }
  }
}

/**
 * Get all live sockets in a room.
 * Automatically prunes dead (non-OPEN) sockets.
 *
 * @param {string} roomKey
 * @returns {WebSocket[]}
 */
export function getRoomClients(roomKey) {
  const room = rooms.get(roomKey);
  if (!room || room.size === 0) return [];

  const alive = [];
  for (const socket of room) {
    if (socket.readyState === WebSocket.OPEN) {
      alive.push(socket);
    } else {
      // Prune dead socket
      room.delete(socket);
    }
  }

  if (room.size === 0) {
    rooms.delete(roomKey);
  }

  return alive;
}

/**
 * Get the number of clients in a room.
 * @param {string} roomKey
 * @returns {number}
 */
export function getRoomSize(roomKey) {
  return getRoomClients(roomKey).length;
}

/**
 * Get all active room keys.
 * Useful for monitoring / debugging.
 * @returns {string[]}
 */
export function getAllRoomKeys() {
  return [...rooms.keys()];
}

/**
 * Get total connected client count across all rooms.
 * Note: a single socket may appear in multiple rooms (user + job rooms).
 * @returns {number}
 */
export function getTotalRoomSlots() {
  let total = 0;
  for (const room of rooms.values()) {
    total += room.size;
  }
  return total;
}

/**
 * Clear all rooms (used in tests / graceful shutdown).
 */
export function clearAllRooms() {
  rooms.clear();
}