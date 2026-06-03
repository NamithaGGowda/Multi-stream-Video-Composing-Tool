// ─────────────────────────────────────────────────────────────────────────────
// src/controllers/user.controller.js
// ─────────────────────────────────────────────────────────────────────────────

import { validationResult } from 'express-validator';
import * as userService from '../services/user.service.js';
import {
  sendSuccess,
  sendValidationError,
  sendError,
} from '../utils/response.utils.js';
import { buildQuotaSummary } from '../utils/quota.utils.js';
import { removeTempFile } from '../middleware/upload.middleware.js';

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    sendValidationError(res, errors.array().map((e) => ({ field: e.path, message: e.msg })));
    return true;
  }
  return false;
}

/**
 * GET /api/users/me
 */
export async function getProfile(req, res, next) {
  try {
    const user = await userService.getUserById(req.user.id);
    return sendSuccess(res, { user }, 'Profile retrieved');
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/users/me
 */
export async function updateProfile(req, res, next) {
  try {
    if (handleValidation(req, res)) return;

    const { displayName, email } = req.body;
    const user = await userService.updateUser(req.user.id, { displayName, email });
    return sendSuccess(res, { user }, 'Profile updated');
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/users/me/avatar
 */
export async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      return sendError(res, 'No avatar file provided', 400);
    }

    const user = await userService.updateAvatar(
      req.user.id,
      req.file.path,
      req.user.avatarPublicId || null
    );

    return sendSuccess(res, { user }, 'Avatar updated');
  } catch (err) {
    return next(err);
  } finally {
    // Always clean up temp file
    if (req.file?.path) removeTempFile(req.file.path);
  }
}

/**
 * DELETE /api/users/me/avatar
 */
export async function deleteAvatar(req, res, next) {
  try {
    const user = await userService.removeAvatar(req.user.id, req.user.avatarPublicId);
    return sendSuccess(res, { user }, 'Avatar removed');
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/users/me/quota
 */
export async function getQuota(req, res, next) {
  try {
    const user  = await userService.getUserById(req.user.id);
    const quota = buildQuotaSummary(user);
    return sendSuccess(res, { quota }, 'Quota retrieved');
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/users/me
 */
export async function deleteAccount(req, res, next) {
  try {
    if (handleValidation(req, res)) return;

    const { password } = req.body;
    await userService.deleteUserAccount(req.user.id, password);
    return sendSuccess(res, {}, 'Account deleted successfully');
  } catch (err) {
    return next(err);
  }
}