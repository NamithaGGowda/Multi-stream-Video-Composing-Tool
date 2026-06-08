// ─────────────────────────────────────────────────────────────────────────────
// src/services/objectRemoval.service.js
// Brush-to-mask object removal using LaMa (zylim0702/remove-object) on Replicate.
// Frontend paints a mask (white = remove); we upload it + the image to LaMa.
// ─────────────────────────────────────────────────────────────────────────────

import Replicate from 'replicate';
import https from 'https';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import prisma from '../config/db.js';
import { getFolder } from '../config/cloudinary.js';
import { getTempDir, cleanTempFile } from '../config/ffmpeg.js';
import { createAppError } from '../middleware/error.middleware.js';
import { incrementStorageUsage } from '../utils/quota.utils.js';
import { bytesToMb } from '../utils/cloudinary.utils.js';

// LaMa inpainting model — pinned version (non-official models need the hash)
const LAMA_MODEL =
  'zylim0702/remove-object:0e3a841c913f597c1e4c321560aa69e2bc1f15c65f8c366caafc379240efd8ba';

// ─── Replicate client ─────────────────────────────────────────────────────────

function getReplicateClient() {
  if (!process.env.REPLICATE_API_KEY) {
    throw createAppError(
      'REPLICATE_API_KEY is not set in .env. Add it to use AI object removal.',
      500,
      'REPLICATE_NOT_CONFIGURED'
    );
  }
  return new Replicate({ auth: process.env.REPLICATE_API_KEY });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file     = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(destPath); } catch (_) {}
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch (_) {}
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (err) => {
        try { fs.unlinkSync(destPath); } catch (_) {}
        reject(err);
      });
    }).on('error', reject);
  });
}

function uploadToCloudinary(source, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(source, options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// ─── Remove object with a painted mask ───────────────────────────────────────

/**
 * Remove an object using a user-painted mask.
 *
 * @param {string} assetId
 * @param {string} userId
 * @param {object} params
 * @param {string} params.maskDataUrl  - base64 PNG data URL from the canvas
 *                                       (white = remove, black = keep)
 * @param {'new'|'replace'} params.mode
 * @param {string} [params.newName]
 * @returns {Promise<{ asset: object, mode: string }>}
 */
export async function removeObjectWithMask(assetId, userId, { maskDataUrl, mode = 'new', newName }) {
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: assetId, userId, deletedAt: null },
  });
  if (!asset) throw createAppError('Asset not found', 404, 'NOT_FOUND');
  if (asset.type !== 'IMAGE') {
    throw createAppError('Object removal only supports images currently.', 400, 'UNSUPPORTED_TYPE');
  }
  if (!maskDataUrl || !maskDataUrl.startsWith('data:image')) {
    throw createAppError('A valid mask image is required.', 400, 'INVALID_MASK');
  }

  const replicate = getReplicateClient();
  const folder    = getFolder(userId, 'images');

  // 1. Upload the painted mask to Cloudinary so Replicate can fetch it by URL
  console.log('[LaMa] Uploading mask to Cloudinary...');
  const maskUpload = await uploadToCloudinary(maskDataUrl, {
    folder:        `${folder}/masks`,
    public_id:     `mask_${uuidv4()}`,
    resource_type: 'image',
    overwrite:     false,
  });
  const maskUrl = maskUpload.secure_url;
  console.log(`[LaMa] Mask URL: ${maskUrl}`);

  // 2. Run LaMa inpainting
  console.log('[LaMa] Running inpainting...');
  console.log(`[LaMa] Image: ${asset.cloudinarySecureUrl}`);

  const output = await replicate.run(LAMA_MODEL, {
    input: {
      image: asset.cloudinarySecureUrl,
      mask:  maskUrl,
    },
  });

  const resultUrl = typeof output === 'string'
    ? output
    : Array.isArray(output) ? String(output[0]) : String(output);

  if (!resultUrl || resultUrl === 'undefined') {
    throw createAppError('LaMa returned no result. Please try again.', 500, 'LAMA_NO_OUTPUT');
  }
  console.log(`[LaMa] Result URL: ${resultUrl}`);

  // 3. Download result and upload to Cloudinary
  const tmpPath = path.join(getTempDir(), `lama_${uuidv4()}.png`);

  try {
    await downloadFile(resultUrl, tmpPath);

    const baseName  = asset.name.replace(/\.[^.]+$/, '');
    const ext       = asset.name.match(/\.[^.]+$/)?.[0] || '.png';
    const finalName = newName || `${baseName}_removed${ext}`;

    let uploadResult;
    if (mode === 'replace') {
      uploadResult = await uploadToCloudinary(tmpPath, {
        public_id:     asset.cloudinaryPublicId,
        resource_type: 'image',
        overwrite:     true,
        invalidate:    true,
      });
    } else {
      uploadResult = await uploadToCloudinary(tmpPath, {
        folder,
        resource_type: 'image',
        overwrite:     false,
      });
    }

    const newSizeMb = bytesToMb(uploadResult.bytes || 0);
    let savedAsset;

    if (mode === 'replace') {
      savedAsset = await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          cloudinaryUrl:       uploadResult.url,
          cloudinarySecureUrl: uploadResult.secure_url,
          width:               uploadResult.width  || asset.width,
          height:              uploadResult.height || asset.height,
          fileSizeMb:          newSizeMb,
          updatedAt:           new Date(),
        },
      });
      const delta = newSizeMb - (asset.fileSizeMb || 0);
      if (delta !== 0) await incrementStorageUsage(userId, delta);
    } else {
      savedAsset = await prisma.mediaAsset.create({
        data: {
          userId,
          type:                'IMAGE',
          name:                finalName,
          mimeType:            'image/png',
          cloudinaryPublicId:  uploadResult.public_id,
          cloudinaryUrl:       uploadResult.url,
          cloudinarySecureUrl: uploadResult.secure_url,
          width:               uploadResult.width  || asset.width,
          height:              uploadResult.height || asset.height,
          fileSizeMb:          newSizeMb,
          thumbnailUrl:        asset.thumbnailUrl,
          thumbnailPublicId:   asset.thumbnailPublicId,
        },
      });
      await incrementStorageUsage(userId, newSizeMb);
    }

    // Clean up the temporary mask from Cloudinary (best-effort)
    try {
      await cloudinary.uploader.destroy(maskUpload.public_id);
    } catch (_) {}

    console.log(`[LaMa] Saved as ${savedAsset.id} (mode: ${mode})`);
    return { asset: savedAsset, mode };

  } finally {
    cleanTempFile(tmpPath);
  }
}