// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/upload.middleware.js
// Multer configuration for file uploads.
// Files are stored in /tmp/editframe first (disk storage), then the service
// layer uploads them to Cloudinary and removes the temp file.
// This avoids the memory-storage limitations for large video files.
// ─────────────────────────────────────────────────────────────────────────────

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getTempDir } from '../config/ffmpeg.js';

// ─── Allowed MIME types ───────────────────────────────────────────────────────

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',     // .mov
  'video/x-msvideo',     // .avi
  'video/webm',
  'video/x-matroska',    // .mkv
  'video/mpeg',
  'video/3gpp',
  'video/x-flv',
];

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',          // .mp3
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',           // .m4a
  'audio/webm',
];

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/svg+xml',
];

const ALLOWED_MEDIA_TYPES = [
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  ...ALLOWED_IMAGE_TYPES,
];

const ALLOWED_AVATAR_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
];

// ─── File size limits ─────────────────────────────────────────────────────────

const SIZE_LIMITS = {
  video:  500 * 1024 * 1024,  // 500 MB
  audio:   50 * 1024 * 1024,  //  50 MB
  image:   20 * 1024 * 1024,  //  20 MB
  avatar:   5 * 1024 * 1024,  //   5 MB
};

// ─── Storage engine (disk) ────────────────────────────────────────────────────

/**
 * Disk storage engine that writes to the configured temp directory.
 * Generates unique filenames to avoid collisions.
 */
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = getTempDir();
    // Ensure temp dir exists (may have been cleared)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${baseName}_${unique}${ext}`);
  },
});

// ─── File filter factories ────────────────────────────────────────────────────

/**
 * Returns a multer fileFilter that only accepts the given MIME types.
 *
 * @param {string[]} allowedTypes
 * @returns {multer.Options['fileFilter']}
 */
function makeFileFilter(allowedTypes) {
  return (_req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(
        `File type '${file.mimetype}' is not allowed. Accepted types: ${allowedTypes.join(', ')}`
      );
      err.code = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  };
}

// ─── Multer instances ─────────────────────────────────────────────────────────

/**
 * Upload a single media file (video, audio, or image).
 * Field name: 'file'
 * Max size: depends on type (enforced in service after MIME detection)
 * Global file size cap: 500 MB (video maximum)
 *
 * @type {import('multer').Multer}
 */
export const mediaUpload = multer({
  storage:    diskStorage,
  limits:     { fileSize: SIZE_LIMITS.video },
  fileFilter: makeFileFilter(ALLOWED_MEDIA_TYPES),
});

/**
 * Upload a user avatar.
 * Field name: 'avatar'
 * Max size: 5 MB
 *
 * @type {import('multer').Multer}
 */
export const avatarUpload = multer({
  storage:    diskStorage,
  limits:     { fileSize: SIZE_LIMITS.avatar },
  fileFilter: makeFileFilter(ALLOWED_AVATAR_TYPES),
});

/**
 * Upload a project thumbnail image.
 * Field name: 'thumbnail'
 *
 * @type {import('multer').Multer}
 */
export const thumbnailUpload = multer({
  storage:    diskStorage,
  limits:     { fileSize: SIZE_LIMITS.image },
  fileFilter: makeFileFilter(ALLOWED_IMAGE_TYPES),
});

// ─── Middleware wrappers ──────────────────────────────────────────────────────

/**
 * Middleware: accept a single media file on field 'file'.
 * @type {import('express').RequestHandler}
 */
export const uploadSingleMedia = mediaUpload.single('file');

/**
 * Middleware: accept a single avatar image on field 'avatar'.
 * @type {import('express').RequestHandler}
 */
export const uploadSingleAvatar = avatarUpload.single('avatar');

/**
 * Middleware: accept a single thumbnail image on field 'thumbnail'.
 * @type {import('express').RequestHandler}
 */
export const uploadSingleThumbnail = thumbnailUpload.single('thumbnail');

/**
 * Middleware: accept up to 10 media files on field 'files'.
 * Used for bulk import.
 * @type {import('express').RequestHandler}
 */
export const uploadMultipleMedia = mediaUpload.array('files', 10);

// ─── Post-upload helpers ──────────────────────────────────────────────────────

/**
 * Remove a temp file left by multer after it has been uploaded to Cloudinary.
 * Call this in the service/controller after a successful Cloudinary upload.
 *
 * @param {string} filePath
 */
export function removeTempFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {
    // noop — clean-up is best-effort
  }
}

/**
 * Validate the file size against the per-type limit.
 * Call this in the service after MIME type is confirmed,
 * since multer's global limit is set to video max for all uploads.
 *
 * @param {string} mimeType
 * @param {number} sizeBytes
 * @returns {{ valid: boolean, limitMb: number }}
 */
export function validateFileSize(mimeType, sizeBytes) {
  let limit = SIZE_LIMITS.video;

  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) limit = SIZE_LIMITS.audio;
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) limit = SIZE_LIMITS.image;

  return {
    valid:   sizeBytes <= limit,
    limitMb: Math.round(limit / (1024 * 1024)),
  };
}