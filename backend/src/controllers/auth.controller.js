// ─────────────────────────────────────────────────────────────────────────────
// src/controllers/auth.controller.js
// Thin controller layer — validates input, delegates to auth.service.js,
// and formats the HTTP response.
// ─────────────────────────────────────────────────────────────────────────────

import { validationResult } from 'express-validator';
import * as authService from '../services/auth.service.js';
import {
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError,
  sendUnauthorized,
} from '../utils/response.utils.js';
import { refreshCookieOptions, clearCookieOptions } from '../utils/jwt.utils.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check express-validator results and send a 422 if any errors exist.
 * Returns true if there were errors (caller should return early).
 */
function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    sendValidationError(
      res,
      errors.array().map((e) => ({ field: e.path, message: e.msg }))
    );
    return true;
  }
  return false;
}

/**
 * Set the httpOnly refresh token cookie on the response.
 */
function setRefreshCookie(res, token, expiresAt) {
  res.cookie('refreshToken', token, refreshCookieOptions(expiresAt));
}

/**
 * Clear the refresh token cookie.
 */
function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', clearCookieOptions());
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Register a new user with email + password.
 */
export async function register(req, res, next) {
  try {
    if (handleValidationErrors(req, res)) return;

    const { email, password, displayName } = req.body;

    const { user, accessToken, refreshToken, refreshExpiresAt } =
      await authService.registerUser({ email, password, displayName });

    setRefreshCookie(res, refreshToken, refreshExpiresAt);

    return sendCreated(
      res,
      {
        user,
        accessToken,
      },
      'Account created successfully'
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/login
 * Login with email + password.
 */
export async function login(req, res, next) {
  try {
    if (handleValidationErrors(req, res)) return;

    const { email, password } = req.body;
    const userAgent  = req.headers['user-agent'] || null;
    const ipAddress  = req.ip || req.connection?.remoteAddress || null;

    const result = await authService.loginUser({
      email,
      password,
      userAgent,
      ipAddress,
    });

    if (!result) {
      return sendUnauthorized(res, 'Invalid email or password');
    }

    const { user, accessToken, refreshToken, refreshExpiresAt } = result;

    setRefreshCookie(res, refreshToken, refreshExpiresAt);

    return sendSuccess(
      res,
      { user, accessToken },
      'Login successful'
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/logout
 * Revoke the current refresh token and clear the cookie.
 */
export async function logout(req, res, next) {
  try {
    // Get refresh token from cookie or body (support both)
    const token =
      req.cookies?.refreshToken ||
      req.body?.refreshToken    ||
      null;

    if (token) {
      await authService.revokeRefreshToken(token);
    }

    clearRefreshCookie(res);

    return sendSuccess(res, {}, 'Logged out successfully');
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/refresh
 * Issue a new access token using a valid refresh token.
 */
export async function refreshToken(req, res, next) {
  try {
    // Accept token from cookie (preferred) or request body (mobile apps)
    const token =
      req.cookies?.refreshToken ||
      req.body?.refreshToken    ||
      req.headers['x-refresh-token'] ||
      null;

    if (!token) {
      return sendUnauthorized(res, 'Refresh token is required');
    }

    const result = await authService.rotateRefreshToken({
      token,
      userAgent:  req.headers['user-agent'] || null,
      ipAddress:  req.ip || null,
    });

    if (!result) {
      clearRefreshCookie(res);
      return sendUnauthorized(res, 'Refresh token is invalid or has been revoked');
    }

    const { user, accessToken, newRefreshToken, refreshExpiresAt } = result;

    // Rotate cookie with new refresh token
    setRefreshCookie(res, newRefreshToken, refreshExpiresAt);

    return sendSuccess(
      res,
      { user, accessToken },
      'Token refreshed successfully'
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/auth/me
 * Return the currently authenticated user's profile.
 */
export async function getMe(req, res, next) {
  try {
    // req.user is already populated by the `protect` middleware
    return sendSuccess(res, { user: req.user }, 'User profile retrieved');
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/auth/tokens
 * Revoke ALL refresh tokens for this user (signs out all devices).
 */
export async function revokeAllTokens(req, res, next) {
  try {
    const count = await authService.revokeAllUserTokens(req.user.id);

    clearRefreshCookie(res);

    return sendSuccess(
      res,
      { revokedCount: count },
      `Signed out from ${count} device(s) successfully`
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/auth/google/callback
 * Called by Passport after successful Google OAuth.
 * Issues tokens and redirects to the frontend.
 */
export async function googleCallback(req, res, next) {
  try {
    // req.user is populated by passport.authenticate('google')
    if (!req.user) {
      return res.redirect(
        process.env.GOOGLE_FAILURE_REDIRECT || '/login?error=oauth_failed'
      );
    }

    const { accessToken, refreshToken, refreshExpiresAt } =
      await authService.issueTokensForUser(req.user, {
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
      });

    setRefreshCookie(res, refreshToken, refreshExpiresAt);

    // Redirect to frontend with access token in query param
    // (frontend picks it up and stores in memory, then uses cookie for refresh)
    const successUrl = new URL(
      process.env.GOOGLE_SUCCESS_REDIRECT || 'http://localhost:5173/dashboard'
    );
    successUrl.searchParams.set('token', accessToken);

    return res.redirect(successUrl.toString());
  } catch (err) {
    return next(err);
  }
}