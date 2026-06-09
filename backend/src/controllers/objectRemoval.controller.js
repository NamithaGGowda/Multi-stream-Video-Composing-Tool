// src/controllers/objectRemoval.controller.js
import { removeObjectWithMask } from '../services/objectRemoval.service.js';
import { detectObjectAtPoint } from '../services/mobilesam.service.js';
import { sendSuccess, sendCreated, sendError } from '../utils/response.utils.js';

/**
 * POST /api/media/:id/detect-object
 * Body: { x, y }  — normalised click coords (0–1)
 * Runs MobileSAM and returns a mask of the clicked object.
 */
export async function detectObject(req, res, next) {
  try {
    const { x, y } = req.body;
    if (x === undefined || y === undefined) {
      return sendError(res, 'x and y coordinates are required (normalised 0–1)', 400);
    }
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      return sendError(res, 'x and y must be between 0 and 1', 400);
    }
    const result = await detectObjectAtPoint(req.params.id, req.user.id, { x, y });
    return sendSuccess(res, result, 'Object detected');
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/media/:id/remove-object
 * Body: { maskDataUrl, mode, newName }
 */
export async function removeObject(req, res, next) {
  try {
    const { maskDataUrl, mode = 'new', newName } = req.body;
    if (!maskDataUrl) return sendError(res, 'maskDataUrl is required', 400);
    if (!['new', 'replace'].includes(mode)) {
      return sendError(res, 'mode must be "new" or "replace"', 400);
    }
    const result = await removeObjectWithMask(req.params.id, req.user.id, { maskDataUrl, mode, newName });
    return sendCreated(
      res,
      { asset: result.asset, mode: result.mode },
      mode === 'replace' ? 'Object removed and original file updated' : `Object removed and saved as "${result.asset.name}"`
    );
  } catch (err) {
    return next(err);
  }
}