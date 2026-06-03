// src/controllers/timeline.controller.js
import { validationResult } from 'express-validator';
import * as timelineService from '../services/timeline.service.js';
import { sendSuccess, sendNotFound, sendValidationError } from '../utils/response.utils.js';

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    sendValidationError(res, errors.array().map((e) => ({ field: e.path, message: e.msg })));
    return true;
  }
  return false;
}

export async function getTimeline(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    const data = await timelineService.getTimeline(req.params.projectId, req.user.id);
    if (!data) return sendNotFound(res, 'Project');
    return sendSuccess(res, { timeline: data });
  } catch (err) { return next(err); }
}

export async function saveTimeline(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    const { timelineData, label } = req.body;
    const result = await timelineService.saveTimeline(
      req.params.projectId, req.user.id, timelineData, label
    );
    return sendSuccess(res, result, 'Timeline saved');
  } catch (err) { return next(err); }
}

export async function getVersionHistory(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    const versions = await timelineService.getVersionHistory(req.params.projectId, req.user.id);
    return sendSuccess(res, { versions });
  } catch (err) { return next(err); }
}

export async function restoreVersion(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    const result = await timelineService.restoreVersion(
      req.params.projectId, req.params.versionId, req.user.id
    );
    return sendSuccess(res, result, 'Timeline restored to selected version');
  } catch (err) { return next(err); }
}