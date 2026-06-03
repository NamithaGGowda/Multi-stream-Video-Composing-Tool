// ─────────────────────────────────────────────────────────────────────────────
// src/config/db.js
// Prisma Client singleton. Import `prisma` anywhere to query the database.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

// Extend PrismaClient with logging based on environment
const logLevels =
  process.env.NODE_ENV === 'development'
    ? ['query', 'warn', 'error']
    : ['warn', 'error'];

// Singleton pattern: reuse the same PrismaClient instance across hot reloads
// (important for `node --watch` dev mode to avoid "too many connections" errors)
let prisma;

if (!global.__prisma) {
  global.__prisma = new PrismaClient({
    log: logLevels,
    errorFormat: 'pretty',
  });
}

prisma = global.__prisma;

/**
 * Connect to the database.
 * Called once during server bootstrap.
 * Prisma lazily connects on first query, but we call $connect explicitly
 * to surface connection errors at startup rather than at first request.
 *
 * @returns {Promise<void>}
 */
export async function connectDatabase() {
  await prisma.$connect();
}

/**
 * Disconnect from the database.
 * Called during graceful shutdown.
 *
 * @returns {Promise<void>}
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
}

export default prisma;