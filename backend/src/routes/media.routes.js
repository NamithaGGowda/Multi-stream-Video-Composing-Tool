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