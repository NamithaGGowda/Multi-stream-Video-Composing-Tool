// src/controllers/objectRemoval.controller.js
import { removeObjectWithMask } from '../services/objectRemoval.service.js';
import { sendCreated, sendError } from '../utils/response.utils.js';

/**
 * POST /api/media/:id/remove-object
 * Body: { maskDataUrl, mode: 'new'|'replace', newName? }
 * Removes the painted area using LaMa inpainting.
 */
export async function removeObject(req, res, next) {
  try {
    const { maskDataUrl, mode = 'new', newName } = req.body;

    if (!maskDataUrl) {
      return sendError(res, 'maskDataUrl is required', 400);
    }
    if (!['new', 'replace'].includes(mode)) {
      return sendError(res, 'mode must be "new" or "replace"', 400);
    }

    const result = await removeObjectWithMask(req.params.id, req.user.id, {
      maskDataUrl, mode, newName,
    });

    return sendCreated(
      res,
      { asset: result.asset, mode: result.mode },
      mode === 'replace'
        ? 'Object removed and original file updated'
        : `Object removed and saved as "${result.asset.name}"`
    );
  } catch (err) {
    return next(err);
  }
}