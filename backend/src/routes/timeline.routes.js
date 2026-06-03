// ─────────────────────────────────────────────────────────────────────────────
// src/routes/timeline.routes.js
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { param, body } from 'express-validator';
import { protect } from '../middleware/auth.middleware.js';
import {
  getTimeline,
  saveTimeline,
  getVersionHistory,
  restoreVersion,
} from '../controllers/timeline.controller.js';

const router = Router();
router.use(protect);

/**
 * @route   GET /api/timeline/:projectId
 * @access  Private
 * @desc    Get the current timeline JSON for a project
 */
router.get(
  '/:projectId',
  [param('projectId').isUUID().withMessage('Invalid project ID')],
  getTimeline
);

/**
 * @route   PUT /api/timeline/:projectId
 * @access  Private
 * @desc    Save (auto-save) the full timeline JSON for a project.
 *          Creates a version history entry. Keeps last 10 versions.
 */
router.put(
  '/:projectId',
  [
    param('projectId').isUUID().withMessage('Invalid project ID'),
    body('timelineData').notEmpty().withMessage('timelineData is required'),
    body('label').optional().isString().isLength({ max: 80 }),
  ],
  saveTimeline
);

/**
 * @route   GET /api/timeline/:projectId/versions
 * @access  Private
 * @desc    Get the version history list for a project (last 10, no JSON blob)
 */
router.get(
  '/:projectId/versions',
  [param('projectId').isUUID().withMessage('Invalid project ID')],
  getVersionHistory
);

/**
 * @route   POST /api/timeline/:projectId/versions/:versionId/restore
 * @access  Private
 * @desc    Restore a project's timeline to a specific version
 */
router.post(
  '/:projectId/versions/:versionId/restore',
  [
    param('projectId').isUUID().withMessage('Invalid project ID'),
    param('versionId').isUUID().withMessage('Invalid version ID'),
  ],
  restoreVersion
);

export default router;