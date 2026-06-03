// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/rateLimit.middleware.js
// express-rate-limit instances for different endpoint categories.
// Each limiter uses the standard JSON error envelope.
// ─────────────────────────────────────────────────────────────────────────────

import rateLimit from 'express-rate-limit';

// ─── Shared handler ───────────────────────────────────────────────────────────

/**
 * Standard rate-limit exceeded response handler.
 * Returns the same envelope shape as all other API errors.
 */
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please slow down and try again later.',
    code:    'RATE_LIMITED',
    retryAfter: res.getHeader('Retry-After'),
  });
};

// ─── Global rate limiter ──────────────────────────────────────────────────────

/**
 * Applied to every request in server.js.
 * Relatively permissive — catches only extreme abuse.
 *
 * @type {import('express').RequestHandler}
 */
export const globalRateLimiter = rateLimit({
  windowMs:         parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  max:              parseInt(process.env.RATE_LIMIT_MAX        || '200',    10),
  standardHeaders:  true,   // Return RateLimit-* headers
  legacyHeaders:    false,
  handler:          rateLimitHandler,
  skip: (req) => {
    // Skip rate limiting for the health check endpoint
    return req.path === '/health';
  },
});

// ─── Auth rate limiter ────────────────────────────────────────────────────────

/**
 * Strict limiter for auth endpoints (login, register, refresh).
 * Protects against brute-force and credential stuffing.
 *
 * Applied per-IP.
 *
 * @type {import('express').RequestHandler}
 */
export const authRateLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             parseInt(process.env.RATE_LIMIT_AUTH_MAX || '20', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  message:         'Too many authentication attempts. Please wait before trying again.',
  skipSuccessfulRequests: false,
});

// ─── Upload rate limiter ──────────────────────────────────────────────────────

/**
 * Per-IP limit on upload requests.
 * Prevents abuse of Cloudinary bandwidth.
 *
 * @type {import('express').RequestHandler}
 */
export const uploadRateLimiter = rateLimit({
  windowMs:        60 * 60 * 1000, // 1 hour
  max:             parseInt(process.env.RATE_LIMIT_UPLOAD_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

// ─── Export rate limiter ──────────────────────────────────────────────────────

/**
 * Limit how many export jobs a single IP can queue per hour.
 * Export jobs are heavy — even pro users should be throttled here.
 *
 * @type {import('express').RequestHandler}
 */
export const exportRateLimiter = rateLimit({
  windowMs:        60 * 60 * 1000, // 1 hour
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

// ─── AI rate limiter ──────────────────────────────────────────────────────────

/**
 * Limit AI job submissions per IP per hour.
 * AI jobs call external APIs which may have their own rate limits.
 *
 * @type {import('express').RequestHandler}
 */
export const aiRateLimiter = rateLimit({
  windowMs:        60 * 60 * 1000, // 1 hour
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

// ─── Password reset rate limiter ──────────────────────────────────────────────

/**
 * Very strict limiter for password reset requests.
 *
 * @type {import('express').RequestHandler}
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs:        60 * 60 * 1000, // 1 hour
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});