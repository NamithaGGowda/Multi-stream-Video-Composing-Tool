// ─────────────────────────────────────────────────────────────────────────────
// src/routes/media.routes.js
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { param, query } from 'express-validator';
import { protect } from '../middleware/auth.middleware.js';
import { uploadSingleMedia, uploadMultipleMedia } from '../middleware/upload.middleware.js';
import { uploadRateLimiter } from '../middleware/rateLimit.middleware.js';
import {
  listMedia,
  uploadMedia,
  uploadBulk,
  getMediaAsset,
  deleteMediaAsset,
  getUploadSignature,
} from '../controllers/media.controller.js';

const router = Router();
router.use(protect);

/**
 * @route   GET /api/media
 * @access  Private
 * @desc    List user's media assets (paginated, filterable by type)
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('perPage').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(['VIDEO', 'AUDIO', 'IMAGE']).withMessage('Invalid type'),
    query('search').optional().isString().isLength({ max: 100 }),
    query('sort').optional().isIn(['createdAt', 'name', 'fileSizeMb']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  listMedia
);

/**
 * @route   POST /api/media/upload
 * @access  Private
 * @desc    Upload a single media file (multipart/form-data, field: file)
 */
router.post('/upload', uploadRateLimiter, uploadSingleMedia, uploadMedia);

/**
 * @route   POST /api/media/upload/bulk
 * @access  Private
 * @desc    Upload up to 10 media files at once (field: files)
 */
router.post('/upload/bulk', uploadRateLimiter, uploadMultipleMedia, uploadBulk);

/**
 * @route   GET /api/media/signature
 * @access  Private
 * @desc    Get a signed Cloudinary upload signature for direct browser uploads
 */
router.get('/signature', getUploadSignature);

/**
 * @route   GET /api/media/:id
 * @access  Private
 * @desc    Get a single media asset by ID
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid asset ID')],
  getMediaAsset
);

/**
 * @route   DELETE /api/media/:id
 * @access  Private
 * @desc    Delete a media asset from Cloudinary and the database
 */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid asset ID')],
  deleteMediaAsset
);

export default router;

// ─── Edit routes (added for asset editing feature) ────────────────────────────
import { editAsset, previewEdit } from '../controllers/assetEdit.controller.js';

/**
 * @route   POST /api/media/:id/edit
 * @access  Private
 * @desc    Apply edits (brightness, crop, filters, etc.) and save as new asset
 */
router.post(
  '/:id/edit',
  [param('id').isUUID().withMessage('Invalid asset ID')],
  editAsset
);

/**
 * @route   POST /api/media/:id/preview
 * @access  Private
 * @desc    Get instant preview URL with transformations applied (no upload)
 */
router.post(
  '/:id/preview',
  [param('id').isUUID().withMessage('Invalid asset ID')],
  previewEdit
);

// ─── Object removal route (brush mask + LaMa inpainting) ─────────────────────
import { removeObject, detectObject } from '../controllers/objectRemoval.controller.js';

/**
 * @route   POST /api/media/:id/detect-object
 * @access  Private
 * @desc    Run MobileSAM on a click point — returns a mask of the object
 */
router.post(
  '/:id/detect-object',
  [param('id').isUUID().withMessage('Invalid asset ID')],
  detectObject
);

/**
 * @route   POST /api/media/:id/remove-object
 * @access  Private
 * @desc    Run LaMa inpainting with a painted mask — saves result to Cloudinary
 */
router.post(
  '/:id/remove-object',
  [param('id').isUUID().withMessage('Invalid asset ID')],
  removeObject
);