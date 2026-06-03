// src/controllers/ai.controller.js
import { validationResult } from 'express-validator';
import * as aiService from '../services/ai.service.js';
import {
  sendCreated, sendSuccess, sendPaginated,
  sendNotFound, sendValidationError,
} from '../utils/response.utils.js';

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    sendValidationError(res, errors.array().map((e) => ({ field: e.path, message: e.msg })));
    return true;
  }
  return false;
}

export async function submitCaptionJob(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    const { mediaAssetId, language, format } = req.body;
    const job = await aiService.queueAIJob(req.user.id, 'AUTO_CAPTION', {
      mediaAssetId, language: language || 'en', format: format || 'vtt',
    });
    return sendCreated(res, { job }, 'Auto-caption job queued');
  } catch (err) { return next(err); }
}

export async function submitBackgroundRemovalJob(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    const { mediaAssetId, outputFormat } = req.body;
    const job = await aiService.queueAIJob(req.user.id, 'BACKGROUND_REMOVAL', {
      mediaAssetId, outputFormat: outputFormat || 'webm',
    });
    return sendCreated(res, { job }, 'Background removal job queued');
  } catch (err) { return next(err); }
}

export async function submitNoiseSuppressionJob(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    const { mediaAssetId, strength } = req.body;
    const job = await aiService.queueAIJob(req.user.id, 'NOISE_SUPPRESSION', {
      mediaAssetId, strength: strength ?? 0.7,
    });
    return sendCreated(res, { job }, 'Noise suppression job queued');
  } catch (err) { return next(err); }
}

export async function submitSmartCutJob(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    const { mediaAssetId, mode, audioTrackId } = req.body;
    const job = await aiService.queueAIJob(req.user.id, 'SMART_CUT', {
      mediaAssetId, mode: mode || 'beat_sync', audioTrackId: audioTrackId || null,
    });
    return sendCreated(res, { job }, 'Smart cut job queued');
  } catch (err) { return next(err); }
}

export async function getAIJob(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    const job = await aiService.getAIJob(req.params.jobId, req.user.id);
    if (!job) return sendNotFound(res, 'AI job');
    return sendSuccess(res, { job });
  } catch (err) { return next(err); }
}

export async function listAIJobs(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    const page    = parseInt(req.query.page    || '1',  10);
    const perPage = parseInt(req.query.perPage || '20', 10);
    const { items, total } = await aiService.listAIJobs(req.user.id, {
      page, perPage,
      type:   req.query.type   || null,
      status: req.query.status || null,
    });
    return sendPaginated(res, items, { total, page, perPage });
  } catch (err) { return next(err); }
}

export async function cancelAIJob(req, res, next) {
  try {
    if (handleValidation(req, res)) return;
    await aiService.cancelAIJob(req.params.jobId, req.user.id);
    return sendSuccess(res, {}, 'AI job cancelled');
  } catch (err) { return next(err); }
}