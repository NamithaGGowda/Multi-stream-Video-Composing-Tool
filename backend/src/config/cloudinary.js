// ─────────────────────────────────────────────────────────────────────────────
// src/config/cloudinary.js
// Cloudinary SDK configuration and shared upload helpers.
// ─────────────────────────────────────────────────────────────────────────────

import { v2 as cloudinary } from 'cloudinary';

/**
 * Initialise the Cloudinary SDK with credentials from environment variables.
 * Called once during server bootstrap.
 */
export function initCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn('[Cloudinary] Missing credentials (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET). Upload features will not work until you add them to .env');
    return; // soft-fail — server boots, uploads fail at runtime with a clear error
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key:    CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure:     true,
  });
}

// ─── Folder helpers ───────────────────────────────────────────────────────────

const BASE = process.env.CLOUDINARY_BASE_FOLDER || 'editframe';

/** Returns the Cloudinary folder path for a given user + asset type. */
export function getFolder(userId, type) {
  // type: 'videos' | 'audio' | 'images' | 'thumbnails' | 'exports' | 'avatars'
  return `${BASE}/${userId}/${type}`;
}

// ─── Upload helpers ───────────────────────────────────────────────────────────

/**
 * Upload a local file path or buffer to Cloudinary.
 *
 * @param {string} source        - Local file path, URL, base64 data URI, or Buffer
 * @param {object} options       - Cloudinary upload options
 * @param {string} options.folder
 * @param {string} [options.public_id]
 * @param {string} [options.resource_type] - 'video' | 'image' | 'raw' | 'auto'
 * @param {string} [options.transformation]
 * @returns {Promise<object>}    - Cloudinary upload result
 */
export async function uploadToCloudinary(source, options = {}) {
  const defaults = {
    resource_type: 'auto',
    use_filename:  true,
    unique_filename: true,
    overwrite: false,
  };

  return cloudinary.uploader.upload(source, { ...defaults, ...options });
}

/**
 * Upload a stream to Cloudinary (for piped ffmpeg output / chunked uploads).
 *
 * @param {object} options  - Cloudinary upload options
 * @returns {{ stream: UploadStream, result: Promise<object> }}
 */
export function uploadStreamToCloudinary(options = {}) {
  let resolveResult;
  let rejectResult;

  const result = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const stream = cloudinary.uploader.upload_stream(
    {
      resource_type: 'video',
      ...options,
    },
    (error, uploadResult) => {
      if (error) return rejectResult(error);
      resolveResult(uploadResult);
    }
  );

  return { stream, result };
}

/**
 * Delete an asset from Cloudinary by public_id.
 *
 * @param {string} publicId
 * @param {string} [resourceType] - 'video' | 'image' | 'raw'
 * @returns {Promise<object>}
 */
export async function deleteFromCloudinary(publicId, resourceType = 'video') {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

/**
 * Delete multiple assets in bulk (max 100 per call).
 *
 * @param {string[]} publicIds
 * @param {string}   [resourceType]
 * @returns {Promise<object>}
 */
export async function deleteManyFromCloudinary(publicIds, resourceType = 'video') {
  if (!publicIds.length) return {};
  return cloudinary.api.delete_resources(publicIds, { resource_type: resourceType });
}

/**
 * Generate an optimised delivery URL for a Cloudinary asset.
 *
 * @param {string} publicId
 * @param {object} [transformations]
 * @returns {string}
 */
export function getCloudinaryUrl(publicId, transformations = {}) {
  return cloudinary.url(publicId, {
    secure: true,
    fetch_format: 'auto',
    quality:      'auto',
    ...transformations,
  });
}

/**
 * Generate a signed upload URL for direct browser-to-Cloudinary uploads
 * (used for chunked uploads to bypass the server file size limit).
 *
 * @param {object} params  - { folder, tags, context, ... }
 * @returns {{ signature: string, timestamp: number, apiKey: string, cloudName: string }}
 */
export function generateUploadSignature(params = {}) {
  const timestamp = Math.round(Date.now() / 1000);
  const toSign = { timestamp, ...params };
  const signature = cloudinary.utils.api_sign_request(
    toSign,
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    signature,
    timestamp,
    apiKey:    process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

export default cloudinary;