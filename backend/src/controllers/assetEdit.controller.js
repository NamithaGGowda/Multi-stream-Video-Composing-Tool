// src/controllers/assetEdit.controller.js
import { applyEditsToAsset, getPreviewUrl } from '../services/assetEdit.service.js';
import prisma from '../config/db.js';
import { sendSuccess, sendCreated, sendNotFound, sendError } from '../utils/response.utils.js';

/**
 * POST /api/media/:id/edit
 */
export async function editAsset(req, res, next) {
  try {
    const { edits, mode = 'new', newName } = req.body;
    if (!edits) return sendError(res, 'edits object is required', 400);
    if (!['new', 'replace'].includes(mode)) {
      return sendError(res, 'mode must be "new" or "replace"', 400);
    }

    const result = await applyEditsToAsset(
      req.params.id, req.user.id, edits, mode, newName
    );

    const message = mode === 'replace'
      ? 'Original file updated successfully'
      : 'Saved as new file in your media library';

    return sendCreated(res, { asset: result.asset, mode: result.mode }, message);
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/media/:id/preview
 */
export async function previewEdit(req, res, next) {
  try {
    const { edits } = req.body;
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: req.params.id, userId: req.user.id, deletedAt: null },
    });
    if (!asset) return sendNotFound(res, 'Asset');

    const resourceType = asset.type === 'IMAGE' ? 'image' : 'video';
    // Use cloudinarySecureUrl directly — avoids doubled-path issues
    const previewUrl = getPreviewUrl(
      asset.cloudinarySecureUrl, resourceType, edits || {}
    );

    return sendSuccess(res, { previewUrl });
  } catch (err) {
    return next(err);
  }
}