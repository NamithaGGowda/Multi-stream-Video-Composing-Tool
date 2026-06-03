// ─────────────────────────────────────────────────────────────────────────────
// src/controllers/media.controller.js
// ─────────────────────────────────────────────────────────────────────────────

import { validationResult } from 'express-validator';
import * as mediaService from '../services/media.service.js';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendNotFound,
  sendError,
  sendValidationError,
} from '../utils/response.utils.js';
import { generateUploadSignature, getFolder } from '../config/cloudinary.js';
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
 * GET /api/media
 */
export async function listMedia(req, res, next) {
  try {
    if (handleValidation(req, res)) return;

    const page    = parseInt(req.query.page    || '1',  10);
    const perPage = parseInt(req.query.perPage || '20', 10);
    const type    = req.query.type   || null;
    const search  = req.query.search || '';
    const sort    = req.query.sort   || 'createdAt';
    const order   = req.query.order  || 'desc';

    const { items, total } = await mediaService.listUserMedia(req.user.id, {
      page, perPage, type, search, sort, order,
    });

    return sendPaginated(res, items, { total, page, perPage });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/media/upload
 */
export async function uploadMedia(req, res, next) {
  try {
    if (!req.file) return sendError(res, 'No file provided', 400);

    const asset = await mediaService.uploadMediaAsset(req.user, req.file);
    return sendCreated(res, { asset }, 'Media uploaded successfully');
  } catch (err) {
    return next(err);
  } finally {
    if (req.file?.path) removeTempFile(req.file.path);
  }
}

/**
 * POST /api/media/upload/bulk
 */
export async function uploadBulk(req, res, next) {
  try {
    if (!req.files?.length) return sendError(res, 'No files provided', 400);

    const results = await mediaService.uploadBulkMedia(req.user, req.files);
    return sendCreated(
      res,
      { assets: results.succeeded, errors: results.failed },
      `Uploaded ${results.succeeded.length} of ${req.files.length} files`
    );
  } catch (err) {
    return next(err);
  } finally {
    // Clean up all temp files regardless of success/failure
    if (req.files) {
      for (const file of req.files) {
        if (file.path) removeTempFile(file.path);
      }
    }
  }
}

/**
 * GET /api/media/:id
 */
export async function getMediaAsset(req, res, next) {
  try {
    if (handleValidation(req, res)) return;

    const asset = await mediaService.getAssetById(req.params.id, req.user.id);
    if (!asset) return sendNotFound(res, 'Media asset');

    return sendSuccess(res, { asset });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/media/:id
 */
export async function deleteMediaAsset(req, res, next) {
  try {
    if (handleValidation(req, res)) return;

    await mediaService.deleteAsset(req.params.id, req.user.id);
    return sendSuccess(res, {}, 'Media asset deleted');
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/media/signature
 * Returns a signed upload signature for direct browser → Cloudinary uploads.
 */
export async function getUploadSignature(req, res, next) {
  try {
    const folder    = getFolder(req.user.id, 'videos');
    const signature = generateUploadSignature({ folder, tags: `user_${req.user.id}` });
    return sendSuccess(res, signature, 'Upload signature generated');
  } catch (err) {
    return next(err);
  }
}