// ─────────────────────────────────────────────────────────────────────────────
// src/config/redis.js
// ioredis client singleton. Soft-fails if Redis is not available so the
// API server can boot without Redis (queue features disabled).
// ─────────────────────────────────────────────────────────────────────────────

import Redis from 'ioredis';

function buildRedisOptions() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  return {
    host:     process.env.REDIS_HOST || '127.0.0.1',
    port:     parseInt(process.env.REDIS_PORT || '6379', 10),
    db:       parseInt(process.env.REDIS_DB   || '0',    10),
    // Stop retrying after 3 attempts so the server doesn't hang on startup
    retryStrategy(times) {
      if (times > 3) return null; // stop retrying
      return Math.min(times * 500, 2000);
    },
    maxRetriesPerRequest: null,
    enableReadyCheck:     false,
    lazyConnect:          true, // don't connect until connectRedis() is called
  };
}

let redisClient = null;
let redisAvailable = false;

/**
 * Returns the shared ioredis client.
 * @returns {Redis}
 */
export function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(buildRedisOptions());

    redisClient.on('ready', () => {
      redisAvailable = true;
      console.log('[Redis] Client ready');
    });

    redisClient.on('error', (err) => {
      // Only log once, not every retry
      if (redisAvailable) {
        console.error('[Redis] Client error:', err.message);
        redisAvailable = false;
      }
    });

    redisClient.on('close', () => {
      redisAvailable = false;
    });
  }
  return redisClient;
}

/**
 * Create a dedicated ioredis connection for BullMQ.
 * Returns null if Redis is not available.
 * @returns {Redis|null}
 */
export function createRedisConnection() {
  return new Redis(buildRedisOptions());
}

/**
 * Returns true if Redis is currently connected.
 * @returns {boolean}
 */
export function isRedisAvailable() {
  return redisAvailable;
}

/**
 * Connect to Redis at startup.
 * Soft-fails with a warning if Redis is not available.
 * Queue features (video processing, export, AI) will be disabled.
 *
 * @returns {Promise<void>}
 */
export async function connectRedis() {
  const client = getRedisClient();

  return new Promise((resolve) => {
    // Already connected
    if (client.status === 'ready') {
      redisAvailable = true;
      return resolve();
    }

    const timeout = setTimeout(() => {
      console.warn(
        '[Redis] Connection timed out — Redis is not running.\n' +
        '        Queue features (video processing, export jobs, AI jobs) will be unavailable.\n' +
        '        Install Redis to enable them: https://redis.io/docs/getting-started/\n' +
        '        On Windows use: https://github.com/microsoftarchive/redis/releases\n' +
        '        Or run via Docker: docker run -d -p 6379:6379 redis:7'
      );
      resolve(); // resolve instead of reject — server continues without Redis
    }, 3000);

    client.connect().then(() => {
      clearTimeout(timeout);
      redisAvailable = true;
      resolve();
    }).catch(() => {
      clearTimeout(timeout);
      console.warn(
        '[Redis] Could not connect — Redis is not running.\n' +
        '        Queue features (video processing, export jobs, AI jobs) will be unavailable.\n' +
        '        Install Redis to enable them, or run: docker run -d -p 6379:6379 redis:7'
      );
      resolve(); // resolve — don't crash the server
    });
  });
}

/**
 * Gracefully disconnect the shared Redis client.
 * @returns {Promise<void>}
 */
export async function disconnectRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (_) {
      redisClient.disconnect();
    }
    redisClient = null;
    redisAvailable = false;
    console.log('[Redis] Disconnected');
  }
}

export default getRedisClient;