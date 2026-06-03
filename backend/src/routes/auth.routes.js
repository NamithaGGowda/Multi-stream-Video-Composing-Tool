// ─────────────────────────────────────────────────────────────────────────────
// src/routes/auth.routes.js
// Authentication routes: register, login, logout, token refresh, Google OAuth.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import passport from 'passport';
import { authRateLimiter } from '../middleware/rateLimit.middleware.js';
import { protect } from '../middleware/auth.middleware.js';
import { configurePassport } from '../middleware/auth.middleware.js';
import {
  register,
  login,
  logout,
  refreshToken,
  getMe,
  googleCallback,
  revokeAllTokens,
} from '../controllers/auth.controller.js';
import { body } from 'express-validator';

// Configure Passport strategies (runs once on import)
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
    .isLength({ min: 2,  max: 50 }).withMessage('Display name must be 2–50 characters')
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
 * @desc    Login with email + password. Returns access token + sets refresh cookie.
 */
router.post('/login', authRateLimiter, loginValidation, login);

/**
 * @route   POST /api/auth/logout
 * @access  Private
 * @desc    Revoke the current refresh token and clear the cookie.
 */
router.post('/logout', protect, logout);

/**
 * @route   POST /api/auth/refresh
 * @access  Public (requires valid refresh token cookie or body)
 * @desc    Issue a new access token using a valid refresh token.
 */
router.post('/refresh', authRateLimiter, refreshToken);

/**
 * @route   GET /api/auth/me
 * @access  Private
 * @desc    Return the currently authenticated user's profile.
 */
router.get('/me', protect, getMe);

/**
 * @route   DELETE /api/auth/tokens
 * @access  Private
 * @desc    Revoke ALL refresh tokens for this user (sign out all devices).
 */
router.delete('/tokens', protect, revokeAllTokens);

/**
 * @route   GET /api/auth/google
 * @access  Public
 * @desc    Initiate Google OAuth flow.
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope:   ['profile', 'email'],
    session: false,
  })
);

/**
 * @route   GET /api/auth/google/callback
 * @access  Public (Google redirect)
 * @desc    Google OAuth callback. Issues tokens and redirects to frontend.
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session:      false,
    failureRedirect: process.env.GOOGLE_FAILURE_REDIRECT || '/login?error=oauth_failed',
  }),
  googleCallback
);

export default router;