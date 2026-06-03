// ─────────────────────────────────────────────────────────────────────────────
// src/config/redis.js
// ioredis client singleton shared by BullMQ queues, workers, and any
// direct Redis operations (caching, session flags, etc.).
// ─────────────────────────────────────────────────────────────────────────────

import Redis from 'ioredis';

// ─── Build connection options from env ───────────────────────────────────────

function buildRedisOptions() {
  // If a full REDIS_URL is provided, ioredis parses it automatically
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const options = {
    host:     process.env.REDIS_HOST     || '127.0.0.1',
    port:     parseInt(process.env.REDIS_PORT || '6379', 10),
    db:       parseInt(process.env.REDIS_DB   || '0',    10),
    // Retry strategy: exponential back-off, max 10 retries
    retryStrategy(times) {
      if (times > 10) {
        console.error('[Redis] Max reconnection attempts reached. Giving up.');
        return null; // stop retrying
      }
      const delay = Math.min(times * 200, 3000);
      console.warn(`[Redis] Reconnecting… attempt ${times} (delay ${delay}ms)`);
      return delay;
    },
    // Required by BullMQ — do not set maxRetriesPerRequest globally
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (process.env.REDIS_PASSWORD) {
    options.password = process.env.REDIS_PASSWORD;
  }

  return options;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let redisClient;

/**
 * Returns the shared ioredis client, creating it on first call.
 * BullMQ requires a fresh Redis instance per queue/worker, so this is used
 * for general operations. Queues/workers create their own instances via
 * `createRedisConnection()`.
 *
 * @returns {Redis}
 */
export function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(buildRedisOptions());

    redisClient.on('connect', () => {
      console.log('[Redis] Client connected');
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Client ready');
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Client error:', err.message);
    });

    redisClient.on('close', () => {
      console.warn('[Redis] Connection closed');
    });
  }

  return redisClient;
}

/**
 * Create a dedicated ioredis connection for BullMQ.
 * BullMQ requires each Queue and Worker to have its own connection
 * (they cannot share a single client).
 *
 * @returns {Redis}
 */
export function createRedisConnection() {
  return new Redis(buildRedisOptions());
}

/**
 * Connect to Redis (validates connection at startup).
 * @returns {Promise<void>}
 */
export async function connectRedis() {
  const client = getRedisClient();

  return new Promise((resolve, reject) => {
    if (client.status === 'ready') {
      return resolve();
    }

    client.once('ready', resolve);
    client.once('error', (err) => {
      // Only reject if we haven't connected yet
      if (client.status !== 'ready') reject(err);
    });
  });
}

/**
 * Gracefully disconnect the shared Redis client.
 * @returns {Promise<void>}
 */
export async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Disconnected');
  }
}

export default getRedisClient;