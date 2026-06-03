// ─────────────────────────────────────────────────────────────────────────────
// src/utils/cloudinary.utils.js
// Higher-level Cloudinary helpers used by services (not raw config).
// Wraps config/cloudinary.js with business-logic concerns like
// folder routing, thumbnail generation, and asset type detection.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  uploadToCloudinary,
  uploadStreamToCloudinary,
  deleteFromCloudinary,
  getFolder,
} from '../config/cloudinary.js';
import { probeMedia, extractMediaInfo, tempFilePath, cleanTempFile } from '../config/ffmpeg.js';
import ffmpeg from 'fluent-ffmpeg';

// ─── Resource type detection ──────────────────────────────────────────────────

/**
 * Map a MIME type to a Cloudinary resource_type.
 *
 * @param {string} mimeType  e.g. 'video/mp4', 'image/jpeg', 'audio/mpeg'
 * @returns {'video'|'image'|'raw'}
 */
export function mimeToResourceType(mimeType) {
  if (!mimeType) return 'raw';
  if (mimeType.startsWith('video/'))  return 'video';
  if (mimeType.startsWith('image/'))  return 'image';
  if (mimeType.startsWith('audio/'))  return 'video'; // Cloudinary stores audio under 'video'
  return 'raw';
}

/**
 * Map a MIME type to an EditFrame MediaType enum value.
 *
 * @param {string} mimeType
 * @returns {'VIDEO'|'AUDIO'|'IMAGE'}
 */
export function mimeToMediaType(mimeType) {
  if (!mimeType) return 'VIDEO';
  if (mimeType.startsWith('video/'))  return 'VIDEO';
  if (mimeType.startsWith('audio/'))  return 'AUDIO';
  if (mimeType.startsWith('image/'))  return 'IMAGE';
  return 'VIDEO';
}

// ─── Upload helpers ───────────────────────────────────────────────────────────

/**
 * Upload a media file to the correct Cloudinary folder for a user.
 * Automatically sets resource_type from mimeType.
 *
 * @param {string} localPath    - Temp file path on disk (from multer)
 * @param {string} userId       - Owner user ID
 * @param {string} mimeType     - File MIME type
 * @param {string} originalName - Original filename (for display_name)
 * @returns {Promise<object>}   - Cloudinary upload result
 */
export async function uploadMediaAsset(localPath, userId, mimeType, originalName) {
  const mediaType    = mimeToMediaType(mimeType);
  const resourceType = mimeToResourceType(mimeType);

  const folderMap = {
    VIDEO: 'videos',
    AUDIO: 'audio',
    IMAGE: 'images',
  };

  const folder    = getFolder(userId, folderMap[mediaType]);
  const publicId  = `${folder}/${uuidv4()}`;
  const baseName  = path.basename(originalName, path.extname(originalName));

  return uploadToCloudinary(localPath, {
    folder,
    public_id:     publicId,
    resource_type: resourceType,
    display_name:  baseName,
    context:       `original_name=${originalName}|owner=${userId}`,
    tags:          [`user_${userId}`, mediaType.toLowerCase()],
  });
}

/**
 * Upload a user avatar image, replacing any existing one.
 *
 * @param {string} localPath          - Temp file path
 * @param {string} userId
 * @param {string|null} existingPublicId  - Previous avatar public_id to delete
 * @returns {Promise<object>}  Cloudinary result
 */
export async function uploadAvatar(localPath, userId, existingPublicId = null) {
  // Delete old avatar if exists
  if (existingPublicId) {
    await deleteFromCloudinary(existingPublicId, 'image').catch(() => null);
  }

  const folder = getFolder(userId, 'avatars');

  return uploadToCloudinary(localPath, {
    folder,
    public_id:         `${folder}/avatar_${userId}`,
    resource_type:     'image',
    overwrite:         true,
    transformation: [
      { width: 256, height: 256, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  });
}

/**
 * Upload a project thumbnail image.
 *
 * @param {string} localPath
 * @param {string} userId
 * @param {string} projectId
 * @param {string|null} existingPublicId
 * @returns {Promise<object>}
 */
export async function uploadProjectThumbnail(localPath, userId, projectId, existingPublicId = null) {
  if (existingPublicId) {
    await deleteFromCloudinary(existingPublicId, 'image').catch(() => null);
  }

  const folder = getFolder(userId, 'thumbnails');

  return uploadToCloudinary(localPath, {
    folder,
    public_id:     `${folder}/project_${projectId}`,
    resource_type: 'image',
    overwrite:     true,
    transformation: [
      { width: 1280, height: 720, crop: 'fill' },
      { quality: 'auto:good', fetch_format: 'auto' },
    ],
  });
}

// ─── Thumbnail generation ─────────────────────────────────────────────────────

/**
 * Extract a thumbnail frame from a video file at a given timestamp
 * and upload it to Cloudinary.
 *
 * @param {string} videoPath         - Local path or Cloudinary URL of the video
 * @param {string} userId
 * @param {string} assetId           - MediaAsset ID (used in public_id)
 * @param {number} [timestampSecs]   - Capture time in seconds (default: 1s)
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export async function generateVideoThumbnail(videoPath, userId, assetId, timestampSecs = 1) {
  const thumbPath = tempFilePath('.jpg', 'thumb_');

  // Extract frame with ffmpeg
  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .on('error', reject)
      .on('end', resolve)
      .screenshots({
        timestamps: [timestampSecs],
        filename:   path.basename(thumbPath),
        folder:     path.dirname(thumbPath),
        size:       '1280x720',
      });
  });

  // Upload to Cloudinary
  const folder = getFolder(userId, 'thumbnails');
  const result = await uploadToCloudinary(thumbPath, {
    folder,
    public_id:     `${folder}/thumb_${assetId}`,
    resource_type: 'image',
    overwrite:     true,
    transformation: [
      { quality: 'auto:good', fetch_format: 'auto' },
    ],
  });

  // Clean up temp file
  cleanTempFile(thumbPath);

  return {
    url:      result.secure_url,
    publicId: result.public_id,
  };
}

// ─── Export upload ────────────────────────────────────────────────────────────

/**
 * Upload a finished export file to Cloudinary.
 * Returns a streaming uploader so the export worker can pipe ffmpeg output
 * directly without writing a large file to disk first.
 *
 * @param {string} userId
 * @param {string} exportJobId
 * @param {string} format          - 'mp4' | 'mov' | 'webm' | 'gif'
 * @returns {{ stream: WritableStream, result: Promise<object> }}
 */
export function uploadExportStream(userId, exportJobId, format = 'mp4') {
  const folder = getFolder(userId, 'exports');

  return uploadStreamToCloudinary({
    folder,
    public_id:     `${folder}/export_${exportJobId}`,
    resource_type: 'video',
    overwrite:     true,
    tags:          [`user_${userId}`, 'export'],
    context:       `export_job=${exportJobId}`,
  });
}

// ─── Media info enrichment ────────────────────────────────────────────────────

/**
 * Probe a Cloudinary video URL and return media info.
 * Used after upload to populate duration/fps/dimensions in the DB.
 *
 * @param {string} cloudinaryUrl
 * @returns {Promise<object>}
 */
export async function getMediaInfoFromUrl(cloudinaryUrl) {
  const metadata = await probeMedia(cloudinaryUrl);
  return extractMediaInfo(metadata);
}

/**
 * Convert bytes to megabytes (2 decimal places).
 * @param {number} bytes
 * @returns {number}
 */
export function bytesToMb(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}