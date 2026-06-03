// ─────────────────────────────────────────────────────────────────────────────
// src/utils/jwt.utils.js
// JWT sign / verify helpers for access tokens and refresh tokens.
// Access tokens: short-lived (15m), sent in Authorization header.
// Refresh tokens: long-lived (30d), stored in httpOnly cookie + DB.
// ─────────────────────────────────────────────────────────────────────────────

import jwt from 'jsonwebtoken';

// ─── Token signing ────────────────────────────────────────────────────────────

/**
 * Sign a short-lived JWT access token.
 *
 * @param {{ id: string, email: string, plan: string }} payload
 * @returns {string}  Signed JWT string
 */
export function signAccessToken(payload) {
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error('JWT_ACCESS_SECRET is not set');
  }
  return jwt.sign(
    {
      sub:   payload.id,
      email: payload.email,
      plan:  payload.plan,
      type:  'access',
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      issuer:    'editframe',
      audience:  'editframe-client',
    }
  );
}

/**
 * Sign a long-lived JWT refresh token.
 * The token ID (jti) is also stored in the DB so it can be revoked.
 *
 * @param {{ id: string }} payload
 * @param {string}         tokenId  - UUID stored as jti, also saved in DB
 * @returns {string}
 */
export function signRefreshToken(payload, tokenId) {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET is not set');
  }
  return jwt.sign(
    {
      sub:  payload.id,
      type: 'refresh',
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      jwtid:     tokenId,
      issuer:    'editframe',
      audience:  'editframe-client',
    }
  );
}

// ─── Token verification ───────────────────────────────────────────────────────

/**
 * Verify a JWT access token.
 *
 * @param {string} token
 * @returns {{ sub: string, email: string, plan: string, type: string, iat: number, exp: number }}
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
    issuer:   'editframe',
    audience: 'editframe-client',
  });
}

/**
 * Verify a JWT refresh token.
 *
 * @param {string} token
 * @returns {{ sub: string, jti: string, type: string, iat: number, exp: number }}
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
    issuer:   'editframe',
    audience: 'editframe-client',
  });
}

/**
 * Decode a JWT without verifying the signature.
 * Use only to inspect an expired token's payload (e.g. for logging).
 * Never trust the output of this for auth decisions.
 *
 * @param {string} token
 * @returns {object|null}
 */
export function decodeTokenUnsafe(token) {
  return jwt.decode(token);
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

/**
 * Cookie options for the httpOnly refresh token cookie.
 * Adjust sameSite/secure for your deployment.
 *
 * @param {Date} expiresAt
 * @returns {import('express').CookieOptions}
 */
export function refreshCookieOptions(expiresAt) {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    domain:   process.env.COOKIE_DOMAIN || undefined,
    path:     '/api/auth',
    expires:  expiresAt,
  };
}

/**
 * Options to clear the refresh token cookie (set in logout).
 * @returns {import('express').CookieOptions}
 */
export function clearCookieOptions() {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    domain:   process.env.COOKIE_DOMAIN || undefined,
    path:     '/api/auth',
  };
}

// ─── Expiry helpers ───────────────────────────────────────────────────────────

/**
 * Parse a duration string like '30d', '15m', '1h' into a future Date.
 *
 * @param {string} duration  - e.g. '30d', '15m', '7d', '1h'
 * @returns {Date}
 */
export function expiryDate(duration) {
  const units = { s: 1, m: 60, h: 3600, d: 86400 };
  const match = String(duration).match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);
  const [, amount, unit] = match;
  return new Date(Date.now() + parseInt(amount) * units[unit] * 1000);
}