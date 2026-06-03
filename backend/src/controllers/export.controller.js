// src/controllers/export.controller.js
import { validationResult } from 'express-validator';
import * as exportService from '../services/export.service.js';
import {
  sendSuccess, sendCreated, sendPaginated,
  sendNotFound, sendValidationError, sendForbidden,
} from '../utils/response.utils.js';

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    sendValidationError(res, errors.array().map((e) => ({ field: e.path, message: e.msg })));
    return true;
  }
  return false;
}

export async function queueExport(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    const { projectId, format, resolution, fps, quality, codec, audioBitrate } = req.body;
    const job = await exportService.queueExportJob(req.user, {
      projectId, format, resolution, fps, quality, codec, audioBitrate,
    });
    return sendCreated(res, { job }, 'Export job queued');
  } catch (err) { return next(err); }
}

export async function getExportJob(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    const job = await exportService.getExportJob(req.params.jobId, req.user.id);
    if (!job) return sendNotFound(res, 'Export job');
    return sendSuccess(res, { job });
  } catch (err) { return next(err); }
}

export async function listExportJobs(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    const page      = parseInt(req.query.page    || '1',  10);
    const perPage   = parseInt(req.query.perPage || '20', 10);
    const projectId = req.query.projectId || null;
    const status    = req.query.status    || null;
    const { items, total } = await exportService.listExportJobs(req.user.id, {
      page, perPage, projectId, status,
    });
    return sendPaginated(res, items, { total, page, perPage });
  } catch (err) { return next(err); }
}

export async function cancelExportJob(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    await exportService.cancelExportJob(req.params.jobId, req.user.id);
    return sendSuccess(res, {}, 'Export job cancelled');
  } catch (err) { return next(err); }
}