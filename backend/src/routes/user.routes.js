// ─────────────────────────────────────────────────────────────────────────────
// src/routes/user.routes.js
// User profile and quota management routes.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { body } from 'express-validator';
import { protect } from '../middleware/auth.middleware.js';
import { uploadSingleAvatar } from '../middleware/upload.middleware.js';
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  getQuota,
  deleteAccount,
} from '../controllers/user.controller.js';

const router = Router();

// All user routes require authentication
router.use(protect);

/**
 * @route   GET /api/users/me
 * @access  Private
 * @desc    Get the authenticated user's full profile
 */
router.get('/me', getProfile);

/**
 * @route   PATCH /api/users/me
 * @access  Private
 * @desc    Update display name (and optionally email)
 */
router.patch(
  '/me',
  [
    body('displayName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('Display name must be 2–50 characters')
      .matches(/^[a-zA-Z0-9 _.-]+$/).withMessage('Display name contains invalid characters'),
    body('email')
      .optional()
      .isEmail().withMessage('Must be a valid email address')
      .normalizeEmail(),
  ],
  updateProfile
);

/**
 * @route   POST /api/users/me/avatar
 * @access  Private
 * @desc    Upload / replace the user's avatar image (multipart/form-data, field: avatar)
 */
router.post('/me/avatar', uploadSingleAvatar, uploadAvatar);

/**
 * @route   DELETE /api/users/me/avatar
 * @access  Private
 * @desc    Remove the user's avatar and reset to default
 */
router.delete('/me/avatar', deleteAvatar);

/**
 * @route   GET /api/users/me/quota
 * @access  Private
 * @desc    Get storage and export minute quota usage for the current user
 */
router.get('/me/quota', getQuota);

/**
 * @route   DELETE /api/users/me
 * @access  Private
 * @desc    Permanently delete the authenticated user's account and all data
 */
router.delete(
  '/me',
  [
    body('password')
      .notEmpty().withMessage('Password is required to confirm account deletion'),
  ],
  deleteAccount
);

export default router;