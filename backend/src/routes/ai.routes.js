// ─────────────────────────────────────────────────────────────────────────────
// src/routes/auth.routes.js
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import passport from 'passport';
import { body } from 'express-validator';
import { authRateLimiter } from '../middleware/rateLimit.middleware.js';
import { protect, configurePassport } from '../middleware/auth.middleware.js';
import {
  register,
  login,
  logout,
  refreshToken,
  getMe,
  googleCallback,
  revokeAllTokens,
} from '../controllers/auth.controller.js';

// Configure Passport strategies (Google only loads if GOOGLE_CLIENT_ID is set)
configurePassport();

const router = Router();

// ─── Validation rules ─────────────────────────────────────────────────────────

const registerValidation = [
  body('email')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email too long'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .isLength({ max: 72  }).withMessage('Password too long')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('displayName')
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Display name must be 2–50 characters')
    .matches(/^[a-zA-Z0-9 _.-]+$/).withMessage('Display name contains invalid characters'),
];

const loginValidation = [
  body('email')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/auth/register
 * @access  Public
 * @desc    Register a new user with email + password
 */
router.post('/register', authRateLimiter, registerValidation, register);

/**
 * @route   POST /api/auth/login
 * @access  Public
 * @desc    Login with email + password
 */
router.post('/login', authRateLimiter, loginValidation, login);

/**
 * @route   POST /api/auth/logout
 * @access  Private
 * @desc    Revoke the current refresh token
 */
router.post('/logout', protect, logout);

/**
 * @route   POST /api/auth/refresh
 * @access  Public
 * @desc    Issue a new access token using a valid refresh token
 */
router.post('/refresh', authRateLimiter, refreshToken);

/**
 * @route   GET /api/auth/me
 * @access  Private
 * @desc    Return the currently authenticated user
 */
router.get('/me', protect, getMe);

/**
 * @route   DELETE /api/auth/tokens
 * @access  Private
 * @desc    Revoke ALL refresh tokens for this user (sign out all devices)
 */
router.delete('/tokens', protect, revokeAllTokens);

/**
 * @route   GET /api/auth/google
 * @access  Public
 * @desc    Initiate Google OAuth flow (only available if GOOGLE_CLIENT_ID is set)
 */
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).json({
      success: false,
      message: 'Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID in .env to enable it.',
      code: 'OAUTH_NOT_CONFIGURED',
    });
  }
  return passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

/**
 * @route   GET /api/auth/google/callback
 * @access  Public (Google redirect)
 * @desc    Google OAuth callback
 */
router.get('/google/callback', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect(process.env.GOOGLE_FAILURE_REDIRECT || '/login?error=oauth_not_configured');
  }
  return passport.authenticate('google', {
    session:         false,
    failureRedirect: process.env.GOOGLE_FAILURE_REDIRECT || '/login?error=oauth_failed',
  })(req, res, next);
}, googleCallback);

export default router;