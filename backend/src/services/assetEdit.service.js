// ─────────────────────────────────────────────────────────────────────────────
// src/services/assetEdit.service.js
// Downloads the original from Cloudinary, processes with Sharp (images)
// or FFmpeg (videos), then re-uploads the result.
// This avoids the Cloudinary HTTP 420 "circular fetch" error.
// ─────────────────────────────────────────────────────────────────────────────

import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/db.js';
import { getFolder } from '../config/cloudinary.js';
import { createAppError } from '../middleware/error.middleware.js';
import { incrementStorageUsage } from '../utils/quota.utils.js';
import { bytesToMb } from '../utils/cloudinary.utils.js';
import { getTempDir, cleanTempFile } from '../config/ffmpeg.js';

// ─── Clamp helper ─────────────────────────────────────────────────────────────

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

// ─── Download file to temp ────────────────────────────────────────────────────

function downloadToTemp(url) {
  return new Promise((resolve, reject) => {
    const ext      = url.split('?')[0].match(/\.[a-zA-Z0-9]+$/)?.[0] || '.jpg';
    const tmpPath  = path.join(getTempDir(), `dl_${uuidv4()}${ext}`);
    const file     = fs.createWriteStream(tmpPath);
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (res) => {
      // Follow redirect
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(tmpPath);
        return downloadToTemp(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(tmpPath);
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(tmpPath)));
      file.on('error', (err) => { fs.unlinkSync(tmpPath); reject(err); });
    }).on('error', (err) => { fs.unlinkSync(tmpPath); reject(err); });
  });
}

// ─── Apply edits with Sharp (images) ─────────────────────────────────────────

async function processImageWithSharp(inputPath, edits, outputPath) {
  const {
    brightness  = 0,   // -100 to 100
    contrast    = 0,   // -100 to 100
    saturation  = 0,   // -100 to 100
    exposure    = 0,   // -100 to 100
    sharpness   = 0,   // 0 to 100
    blur        = 0,   // 0 to 100
    rotate      = 0,
    flipH       = false,
    flipV       = false,
    filter      = null,
    crop        = null,
    text        = null,
  } = edits;

  let img = sharp(inputPath);

  // Get metadata for crop calculations
  const meta = await img.metadata();
  const { width, height } = meta;

  // ── Rotation ──────────────────────────────────────────────────────────────
  if (rotate && rotate !== 0) {
    img = img.rotate(rotate);
  }

  // ── Flip ──────────────────────────────────────────────────────────────────
  if (flipH) img = img.flop();
  if (flipV) img = img.flip();

  // ── Crop to aspect ratio ──────────────────────────────────────────────────
  if (crop?.aspectRatio && width && height) {
    const ratios = {
      '16:9': 16/9, '9:16': 9/16, '1:1': 1,
      '4:3':  4/3,  '3:4':  3/4,  '21:9': 21/9,
    };
    const ratio = ratios[crop.aspectRatio];
    if (ratio) {
      let newW = width;
      let newH = Math.round(width / ratio);
      if (newH > height) { newH = height; newW = Math.round(height * ratio); }
      const left = Math.round((width - newW) / 2);
      const top  = Math.round((height - newH) / 2);
      img = img.extract({ left, top, width: newW, height: newH });
    }
  }

  // ── Color adjustments ──────────────────────────────────────────────────────
  // Sharp's modulate: brightness 0-∞ (1=normal), saturation 0-∞ (1=normal)
  const brightnessF  = 1 + clamp(brightness + exposure, -99, 100) / 100;
  const saturationF  = 1 + clamp(saturation, -99, 100) / 100;

  if (brightnessF !== 1 || saturationF !== 1) {
    img = img.modulate({
      brightness: Math.max(0.01, brightnessF),
      saturation: Math.max(0, saturationF),
    });
  }

  // Contrast via linear transform
  if (contrast !== 0) {
    const factor = (259 * (clamp(contrast, -100, 100) + 255)) / (255 * (259 - clamp(contrast, -100, 100)));
    img = img.linear(factor, -(128 * factor) + 128);
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  if (filter === 'grayscale')       img = img.grayscale();
  if (filter === 'negate')          img = img.negate();
  if (filter === 'sepia') {
    img = img.grayscale().tint({ r: 112, g: 66, b: 20 });
  }
  if (filter === 'art_frost')       img = img.modulate({ saturation: 0.8, brightness: 1.2 }).tint({ r: 180, g: 200, b: 255 });
  if (filter === 'art_aurora')      img = img.modulate({ saturation: 1.4, brightness: 1.1 });
  if (filter === 'art_primavera')   img = img.modulate({ saturation: 1.6, brightness: 1.05 });
  if (filter === 'art_eucalyptus')  img = img.modulate({ saturation: 1.2, hue: 90 });
  if (filter === 'art_linen')       img = img.modulate({ brightness: 1.1, saturation: 0.8 });
  if (filter === 'art_peacock')     img = img.modulate({ saturation: 1.3, hue: 180 });
  if (filter === 'art_incognito')   img = img.modulate({ brightness: 0.9 }).linear(1.2, -15);

  // ── Sharpness ─────────────────────────────────────────────────────────────
  if (sharpness > 0) {
    const sigma = 0.5 + (sharpness / 100) * 2;
    img = img.sharpen({ sigma });
  }

  // ── Blur ──────────────────────────────────────────────────────────────────
  if (blur > 0) {
    const blurSigma = 0.3 + (blur / 100) * 10;
    img = img.blur(blurSigma);
  }

  // ── Output ────────────────────────────────────────────────────────────────
  await img
    .jpeg({ quality: 92, progressive: true })
    .toFile(outputPath);

  return outputPath;
}

// ─── Upload processed file to Cloudinary ─────────────────────────────────────

function uploadFile(filePath, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// ─── Save as new asset ────────────────────────────────────────────────────────

export async function saveAsNewAsset(original, userId, edits, newName) {
  const resourceType = original.type === 'IMAGE' ? 'image' : 'video';
  const folder       = getFolder(userId, original.type === 'IMAGE' ? 'images' : 'videos');
  const tmpInput     = null;
  const tmpOutput    = path.join(getTempDir(), `edited_${uuidv4()}.jpg`);

  let downloadPath = null;

  try {
    // 1. Download original
    downloadPath = await downloadToTemp(original.cloudinarySecureUrl);

    // 2. Process with Sharp
    await processImageWithSharp(downloadPath, edits, tmpOutput);

    // 3. Upload to Cloudinary as new asset
    const uploadResult = await uploadFile(tmpOutput, {
      folder,
      resource_type: resourceType,
      overwrite: false,
    });

    const fileSizeMb = bytesToMb(uploadResult.bytes || 0);
    const baseName   = original.name.replace(/\.[^.]+$/, '');
    const ext        = original.name.match(/\.[^.]+$/)?.[0] || '.jpg';
    const finalName  = newName || `${baseName}_edited${ext}`;

    const newAsset = await prisma.mediaAsset.create({
      data: {
        userId,
        type:                original.type,
        name:                finalName,
        mimeType:            'image/jpeg',
        cloudinaryPublicId:  uploadResult.public_id,
        cloudinaryUrl:       uploadResult.url,
        cloudinarySecureUrl: uploadResult.secure_url,
        duration:            original.duration,
        fps:                 original.fps,
        width:               uploadResult.width  || original.width,
        height:              uploadResult.height || original.height,
        thumbnailUrl:        original.thumbnailUrl,
        thumbnailPublicId:   original.thumbnailPublicId,
        fileSizeMb,
      },
    });

    await incrementStorageUsage(userId, fileSizeMb);
    return newAsset;

  } finally {
    cleanTempFile(downloadPath);
    cleanTempFile(tmpOutput);
  }
}

// ─── Replace existing asset ───────────────────────────────────────────────────

export async function replaceExistingAsset(original, userId, edits) {
  const resourceType = original.type === 'IMAGE' ? 'image' : 'video';
  const tmpOutput    = path.join(getTempDir(), `replace_${uuidv4()}.jpg`);

  let downloadPath = null;

  try {
    // 1. Download original
    downloadPath = await downloadToTemp(original.cloudinarySecureUrl);

    // 2. Process with Sharp
    await processImageWithSharp(downloadPath, edits, tmpOutput);

    // 3. Upload to same public_id with overwrite
    const uploadResult = await uploadFile(tmpOutput, {
      public_id:     original.cloudinaryPublicId,
      resource_type: resourceType,
      overwrite:     true,
      invalidate:    true,
    });

    const oldSizeMb = original.fileSizeMb || 0;
    const newSizeMb = bytesToMb(uploadResult.bytes || 0);

    const updatedAsset = await prisma.mediaAsset.update({
      where: { id: original.id },
      data: {
        cloudinaryUrl:       uploadResult.url,
        cloudinarySecureUrl: uploadResult.secure_url,
        width:               uploadResult.width  || original.width,
        height:              uploadResult.height || original.height,
        fileSizeMb:          newSizeMb,
        updatedAt:           new Date(),
      },
    });

    const delta = newSizeMb - oldSizeMb;
    if (delta !== 0) await incrementStorageUsage(userId, delta);

    return updatedAsset;

  } finally {
    cleanTempFile(downloadPath);
    cleanTempFile(tmpOutput);
  }
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function applyEditsToAsset(assetId, userId, edits, mode = 'new', newName) {
  const original = await prisma.mediaAsset.findFirst({
    where: { id: assetId, userId, deletedAt: null },
  });
  if (!original) throw createAppError('Asset not found', 404, 'NOT_FOUND');

  // For now, Sharp-based processing only supports images
  // Video editing will use FFmpeg (coming soon)
  if (original.type !== 'IMAGE') {
    throw createAppError(
      'Video editing via this endpoint is coming soon. Only image editing is supported currently.',
      400,
      'VIDEO_EDIT_NOT_SUPPORTED'
    );
  }

  const asset = mode === 'replace'
    ? await replaceExistingAsset(original, userId, edits)
    : await saveAsNewAsset(original, userId, edits, newName);

  return { asset, mode };
}

// ─── Preview (CSS only — no server round-trip needed) ─────────────────────────

export function getPreviewUrl(secureUrl) {
  // Preview is handled entirely client-side with CSS filters in the editor
  // No server-side transformation URL needed
  return secureUrl;
}