// ─────────────────────────────────────────────────────────────────────────────
// src/routes/export.routes.js
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect } from '../middleware/auth.middleware.js';
import { exportRateLimiter } from '../middleware/rateLimit.middleware.js';
import {
  queueExport,
  getExportJob,
  listExportJobs,
  cancelExportJob,
} from '../controllers/export.controller.js';

const router = Router();
router.use(protect);

/**
 * @route   POST /api/export
 * @access  Private
 * @desc    Queue a new export job for a project
 */
router.post(
  '/',
  exportRateLimiter,
  [
    body('projectId').isUUID().withMessage('Valid project ID is required'),
    body('format')
      .optional()
      .isIn(['MP4', 'MOV', 'WEBM', 'GIF']).withMessage('Invalid format'),
    body('resolution')
      .optional()
      .isIn(['R_480P', 'R_720P', 'R_1080P', 'R_1440P', 'R_4K']).withMessage('Invalid resolution'),
    body('fps')
      .optional()
      .isInt({ min: 1, max: 120 }).withMessage('FPS must be between 1 and 120'),
    body('quality')
      .optional()
      .isIn(['draft', 'medium', 'high', 'master']).withMessage('Invalid quality preset'),
    body('codec')
      .optional()
      .isString().isLength({ max: 30 }),
    body('audioBitrate')
      .optional()
      .isString().isLength({ max: 10 }),
  ],
  queueExport
);

/**
 * @route   GET /api/export/:jobId
 * @access  Private
 * @desc    Get the status and progress of an export job
 */
router.get(
  '/:jobId',
  [param('jobId').isUUID().withMessage('Invalid job ID')],
  getExportJob
);

/**
 * @route   GET /api/export
 * @access  Private
 * @desc    List all export jobs for the authenticated user
 */
router.get(
  '/',
  [
    query('projectId').optional().isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('perPage').optional().isInt({ min: 1, max: 50 }),
    query('status').optional().isIn(['PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED']),
  ],
  listExportJobs
);

/**
 * @route   POST /api/export/:jobId/cancel
 * @access  Private
 * @desc    Cancel a pending or processing export job
 */
router.post(
  '/:jobId/cancel',
  [param('jobId').isUUID().withMessage('Invalid job ID')],
  cancelExportJob
);

export default router;