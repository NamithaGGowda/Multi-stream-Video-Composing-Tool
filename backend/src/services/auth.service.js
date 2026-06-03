// ─────────────────────────────────────────────────────────────────────────────
// src/services/auth.service.js
// All business logic for authentication: hashing, token issuance,
// refresh token rotation, revocation.
// ─────────────────────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/db.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  expiryDate,
} from '../utils/jwt.utils.js';
import { createAppError } from '../middleware/error.middleware.js';

const BCRYPT_ROUNDS = 12;
// Keep only the last N refresh tokens per user to prevent unbounded growth
const MAX_REFRESH_TOKENS_PER_USER = 10;

// ─── Safe user shape ──────────────────────────────────────────────────────────

/**
 * Strip sensitive fields before returning a user to the client.
 * @param {object} user  Prisma User record
 * @returns {object}
 */
function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ─── Token issuance ───────────────────────────────────────────────────────────

/**
 * Create access + refresh tokens for a user and persist the refresh token.
 *
 * @param {object} user         Prisma User object
 * @param {object} [meta]       { userAgent, ipAddress }
 * @returns {Promise<{ accessToken, refreshToken, refreshExpiresAt, user }>}
 */
export async function issueTokensForUser(user, meta = {}) {
  const tokenId      = uuidv4();
  const refreshExpiry = expiryDate(process.env.JWT_REFRESH_EXPIRES_IN || '30d');

  const accessToken  = signAccessToken({ id: user.id, email: user.email, plan: user.plan });
  const refreshToken = signRefreshToken({ id: user.id }, tokenId);

  // Persist refresh token
  await prisma.refreshToken.create({
    data: {
      id:        tokenId,
      token:     refreshToken,
      userId:    user.id,
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
      expiresAt: refreshExpiry,
    },
  });

  // Prune old tokens so the table doesn't grow forever
  await pruneOldRefreshTokens(user.id);

  return {
    user:             safeUser(user),
    accessToken,
    refreshToken,
    refreshExpiresAt: refreshExpiry,
  };
}

/**
 * Delete the oldest tokens beyond MAX_REFRESH_TOKENS_PER_USER.
 * @param {string} userId
 */
async function pruneOldRefreshTokens(userId) {
  const tokens = await prisma.refreshToken.findMany({
    where:   { userId, revokedAt: null },
    orderBy: { createdAt: 'asc' },
    select:  { id: true },
  });

  if (tokens.length > MAX_REFRESH_TOKENS_PER_USER) {
    const toDelete = tokens
      .slice(0, tokens.length - MAX_REFRESH_TOKENS_PER_USER)
      .map((t) => t.id);

    await prisma.refreshToken.deleteMany({ where: { id: { in: toDelete } } });
  }
}

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * Register a new user with email + password.
 *
 * @param {{ email: string, password: string, displayName: string }} params
 * @returns {Promise<{ user, accessToken, refreshToken, refreshExpiresAt }>}
 * @throws AppError 409 if email already in use
 */
export async function registerUser({ email, password, displayName }) {
  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw createAppError('An account with this email already exists', 409, 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      plan:       'FREE',
      isVerified: false,
    },
  });

  return issueTokensForUser(user);
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Authenticate a user by email + password.
 *
 * @param {{ email, password, userAgent, ipAddress }} params
 * @returns {Promise<{ user, accessToken, refreshToken, refreshExpiresAt } | null>}
 *          Returns null on invalid credentials (never reveals which field is wrong).
 */
export async function loginUser({ email, password, userAgent, ipAddress }) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Use constant-time comparison even if user not found (prevent timing attacks)
  const hash = user?.passwordHash || '$2b$12$invalidhashplaceholderfortiming00000000000000000000';
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid) {
    return null;
  }

  return issueTokensForUser(user, { userAgent, ipAddress });
}

// ─── Logout / Revocation ──────────────────────────────────────────────────────

/**
 * Revoke a single refresh token by its token string.
 * Soft-deletes by setting revokedAt. The token remains in DB for audit.
 *
 * @param {string} tokenString
 * @returns {Promise<void>}
 */
export async function revokeRefreshToken(tokenString) {
  await prisma.refreshToken.updateMany({
    where: {
      token:     tokenString,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

/**
 * Revoke ALL refresh tokens for a user (sign out all devices).
 *
 * @param {string} userId
 * @returns {Promise<number>}  Number of tokens revoked
 */
export async function revokeAllUserTokens(userId) {
  const result = await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
  return result.count;
}

// ─── Token rotation ───────────────────────────────────────────────────────────

/**
 * Validate a refresh token and issue a new access + refresh token pair.
 * Implements token rotation: the old refresh token is revoked on use.
 * Detects reuse attacks: if a revoked token is used, ALL tokens for that
 * user are immediately revoked (token family invalidation).
 *
 * @param {{ token: string, userAgent: string, ipAddress: string }} params
 * @returns {Promise<{ user, accessToken, newRefreshToken, refreshExpiresAt } | null>}
 */
export async function rotateRefreshToken({ token, userAgent, ipAddress }) {
  // 1. Verify JWT signature / expiry
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (_) {
    return null; // Invalid or expired token
  }

  if (decoded.type !== 'refresh') return null;

  // 2. Look up token in DB by jti
  const storedToken = await prisma.refreshToken.findUnique({
    where:   { id: decoded.jti },
    include: { user: true },
  });

  if (!storedToken) return null;

  // 3. Reuse detection — token already revoked
  if (storedToken.revokedAt !== null) {
    // Potential token theft — invalidate entire family for this user
    await revokeAllUserTokens(storedToken.userId);
    console.warn(
      `[Auth] Refresh token reuse detected for user ${storedToken.userId}. All tokens revoked.`
    );
    return null;
  }

  // 4. Check expiry
  if (storedToken.expiresAt < new Date()) {
    return null;
  }

  // 5. Revoke the used token
  await prisma.refreshToken.update({
    where: { id: decoded.jti },
    data:  { revokedAt: new Date() },
  });

  // 6. Issue a new token pair
  const { user } = storedToken;
  const result   = await issueTokensForUser(user, { userAgent, ipAddress });

  return {
    user:             result.user,
    accessToken:      result.accessToken,
    newRefreshToken:  result.refreshToken,
    refreshExpiresAt: result.refreshExpiresAt,
  };
}