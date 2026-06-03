// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/auth.middleware.js
// JWT authentication middleware and Passport.js Google OAuth strategy setup.
// ─────────────────────────────────────────────────────────────────────────────

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { verifyAccessToken } from '../utils/jwt.utils.js';
import { sendUnauthorized, sendForbidden } from '../utils/response.utils.js';
import prisma from '../config/db.js';

// ─── JWT middleware (manual — not passport) ───────────────────────────────────

/**
 * @middleware protect
 * Verifies the JWT access token from the Authorization: Bearer header.
 * Attaches the full Prisma User object to req.user on success.
 *
 * @type {import('express').RequestHandler}
 */
export async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendUnauthorized(res, 'Access token is required');
    }

    const token = authHeader.slice(7);

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendUnauthorized(res, 'Access token has expired');
      }
      return sendUnauthorized(res, 'Invalid access token');
    }

    if (decoded.type !== 'access') {
      return sendUnauthorized(res, 'Invalid token type');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id:                true,
        email:             true,
        displayName:       true,
        avatarUrl:         true,
        avatarPublicId:    true,
        plan:              true,
        isVerified:        true,
        storageUsedMb:     true,
        exportMinutesUsed: true,
        usageResetAt:      true,
        createdAt:         true,
      },
    });

    if (!user) {
      return sendUnauthorized(res, 'User account not found');
    }

    req.user   = user;
    req.userId = user.id;

    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * @middleware optionalAuth
 * Like protect but never rejects unauthenticated requests.
 *
 * @type {import('express').RequestHandler}
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.slice(7);
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (_) {
      return next();
    }

    if (decoded.type !== 'access') return next();

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id:                true,
        email:             true,
        displayName:       true,
        avatarUrl:         true,
        avatarPublicId:    true,
        plan:              true,
        isVerified:        true,
        storageUsedMb:     true,
        exportMinutesUsed: true,
        usageResetAt:      true,
        createdAt:         true,
      },
    });

    if (user) {
      req.user   = user;
      req.userId = user.id;
    }

    return next();
  } catch (_) {
    return next();
  }
}

/**
 * @middleware requirePro
 * Must be used AFTER protect. Rejects FREE plan users.
 *
 * @type {import('express').RequestHandler}
 */
export function requirePro(req, res, next) {
  if (!req.user) return sendUnauthorized(res, 'Authentication required');
  if (req.user.plan !== 'PRO') {
    return sendForbidden(res, 'This feature requires a Pro plan.');
  }
  return next();
}

/**
 * @middleware requireOwnership
 * Factory that checks req.user owns the fetched resource.
 *
 * @param {function(req): Promise<object|null>} fetchResource
 * @returns {import('express').RequestHandler}
 */
export function requireOwnership(fetchResource) {
  return async (req, res, next) => {
    try {
      const resource = await fetchResource(req);
      if (!resource) return sendForbidden(res, 'Resource not found');
      if (resource.userId !== req.user.id) {
        return sendForbidden(res, 'You do not have permission to access this resource');
      }
      req.resource = resource;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

// ─── Passport Google OAuth strategy ──────────────────────────────────────────

/**
 * Configure Passport strategies.
 * Google OAuth is only registered if GOOGLE_CLIENT_ID is present in .env.
 * This prevents a crash on startup when OAuth is not yet configured.
 */
export function configurePassport() {
  // ── Google OAuth — only if credentials are configured ─────────────────────
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID:    process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
          scope:       ['profile', 'email'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email       = profile.emails?.[0]?.value;
            const displayName = profile.displayName || email?.split('@')[0] || 'User';
            const avatarUrl   = profile.photos?.[0]?.value || null;
            const googleId    = profile.id;

            if (!email) {
              return done(new Error('Google account has no email address'), null);
            }

            // 1. Find by googleId
            let user = await prisma.user.findUnique({ where: { googleId } });
            if (user) {
              if (avatarUrl && user.avatarUrl !== avatarUrl) {
                user = await prisma.user.update({
                  where: { id: user.id },
                  data:  { avatarUrl },
                });
              }
              return done(null, user);
            }

            // 2. Find by email — link Google account
            user = await prisma.user.findUnique({ where: { email } });
            if (user) {
              user = await prisma.user.update({
                where: { id: user.id },
                data:  { googleId, avatarUrl: avatarUrl || user.avatarUrl, isVerified: true },
              });
              return done(null, user);
            }

            // 3. Create new user
            user = await prisma.user.create({
              data: { email, displayName, avatarUrl, googleId, isVerified: true, plan: 'FREE' },
            });
            return done(null, user);
          } catch (err) {
            return done(err, null);
          }
        }
      )
    );
    console.log('[Passport] Google OAuth strategy registered');
  } else {
    console.warn('[Passport] GOOGLE_CLIENT_ID not set — Google OAuth disabled. Set credentials in .env to enable it.');
  }

  // Session serialisation (not used — we use JWT, but passport requires it)
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
}

// Initialise passport middleware export
export const passportInitialize = passport.initialize();