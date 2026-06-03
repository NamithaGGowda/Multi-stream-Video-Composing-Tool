// ─────────────────────────────────────────────────────────────────────────────
// src/routes/project.routes.js
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect } from '../middleware/auth.middleware.js';
import { uploadSingleThumbnail } from '../middleware/upload.middleware.js';
import {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  duplicateProject,
  uploadThumbnail,
} from '../controllers/project.controller.js';

const router = Router();
router.use(protect);

/**
 * @route   GET /api/projects
 * @access  Private
 * @desc    List all projects for the authenticated user (paginated, sorted)
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('perPage must be 1–100'),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'title']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('search').optional().isString().isLength({ max: 100 }),
  ],
  listProjects
);

/**
 * @route   POST /api/projects
 * @access  Private
 * @desc    Create a new project
 */
router.post(
  '/',
  [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 1, max: 150 }).withMessage('Title must be 1–150 characters'),
    body('resolution')
      .optional()
      .matches(/^\d+x\d+$/).withMessage('Resolution must be in format WxH (e.g. 1920x1080)'),
    body('fps')
      .optional()
      .isInt({ min: 1, max: 240 }).withMessage('FPS must be between 1 and 240'),
    body('aspectRatio')
      .optional()
      .isString().isLength({ max: 10 }),
  ],
  createProject
);

/**
 * @route   GET /api/projects/:id
 * @access  Private
 * @desc    Get a single project by ID (includes latest timeline data)
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid project ID')],
  getProject
);

/**
 * @route   PATCH /api/projects/:id
 * @access  Private
 * @desc    Update project metadata (title, resolution, fps, etc.)
 */
router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid project ID'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 1, max: 150 }).withMessage('Title must be 1–150 characters'),
    body('resolution')
      .optional()
      .matches(/^\d+x\d+$/).withMessage('Resolution must be in format WxH'),
    body('fps')
      .optional()
      .isInt({ min: 1, max: 240 }).withMessage('FPS must be between 1 and 240'),
    body('duration')
      .optional()
      .isFloat({ min: 0 }).withMessage('Duration must be a non-negative number'),
  ],
  updateProject
);

/**
 * @route   DELETE /api/projects/:id
 * @access  Private
 * @desc    Soft-delete a project
 */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid project ID')],
  deleteProject
);

/**
 * @route   POST /api/projects/:id/duplicate
 * @access  Private
 * @desc    Create an exact copy of a project (new ID, title prefixed with "Copy of")
 */
router.post(
  '/:id/duplicate',
  [param('id').isUUID().withMessage('Invalid project ID')],
  duplicateProject
);

/**
 * @route   POST /api/projects/:id/thumbnail
 * @access  Private
 * @desc    Upload a custom thumbnail for the project (multipart, field: thumbnail)
 */
router.post(
  '/:id/thumbnail',
  [param('id').isUUID().withMessage('Invalid project ID')],
  uploadSingleThumbnail,
  uploadThumbnail
);

export default router;