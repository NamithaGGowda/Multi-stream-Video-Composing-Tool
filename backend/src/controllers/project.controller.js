// ─────────────────────────────────────────────────────────────────────────────
// src/controllers/project.controller.js
// ─────────────────────────────────────────────────────────────────────────────

import { validationResult } from 'express-validator';
import * as projectService from '../services/project.service.js';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendValidationError,
  sendNotFound,
  sendError,
} from '../utils/response.utils.js';
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
 * GET /api/projects
 */
export async function listProjects(req, res, next) {
  try {
    if (handleValidation(req, res)) return;

    const page    = parseInt(req.query.page    || '1',   10);
    const perPage = parseInt(req.query.perPage || '20',  10);
    const sort    = req.query.sort  || 'updatedAt';
    const order   = req.query.order || 'desc';
    const search  = req.query.search || '';

    const { items, total } = await projectService.listUserProjects(req.user.id, {
      page, perPage, sort, order, search,
    });

    return sendPaginated(res, items, { total, page, perPage });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/projects
 */
export async function createProject(req, res, next) {
  try {
    if (handleValidation(req, res)) return;

    const { title, resolution, fps, aspectRatio } = req.body;
    const project = await projectService.createProject(req.user.id, {
      title, resolution, fps, aspectRatio,
    });

    return sendCreated(res, { project }, 'Project created');
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/projects/:id
 */
export async function getProject(req, res, next) {
  try {
    if (handleValidation(req, res)) return;

    const project = await projectService.getProjectById(req.params.id, req.user.id);
    if (!project) return sendNotFound(res, 'Project');

    return sendSuccess(res, { project });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/projects/:id
 */
export async function updateProject(req, res, next) {
  try {
    if (handleValidation(req, res)) return;

    const { title, resolution, fps, duration, aspectRatio, description } = req.body;

    const project = await projectService.updateProject(
      req.params.id,
      req.user.id,
      { title, resolution, fps, duration, aspectRatio, description }
    );

    return sendSuccess(res, { project }, 'Project updated');
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/projects/:id
 */
export async function deleteProject(req, res, next) {
  try {
    if (handleValidation(req, res)) return;

    await projectService.deleteProject(req.params.id, req.user.id);
    return sendSuccess(res, {}, 'Project deleted');
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/projects/:id/duplicate
 */
export async function duplicateProject(req, res, next) {
  try {
    if (handleValidation(req, res)) return;

    const project = await projectService.duplicateProject(req.params.id, req.user.id);
    return sendCreated(res, { project }, 'Project duplicated');
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/projects/:id/thumbnail
 */
export async function uploadThumbnail(req, res, next) {
  try {
    if (!req.file) return sendError(res, 'No thumbnail file provided', 400);

    const project = await projectService.updateProjectThumbnail(
      req.params.id,
      req.user.id,
      req.file.path
    );

    return sendSuccess(res, { project }, 'Thumbnail updated');
  } catch (err) {
    return next(err);
  } finally {
    if (req.file?.path) removeTempFile(req.file.path);
  }
}