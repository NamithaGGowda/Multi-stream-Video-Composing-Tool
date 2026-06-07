// ─────────────────────────────────────────────────────────────────────────────
// src/services/media.service.js
// ─────────────────────────────────────────────────────────────────────────────

import prisma from '../config/db.js';
import {
  uploadMediaAsset as uploadToCloudinary,
  generateVideoThumbnail,
  mimeToMediaType,
  bytesToMb,
} from '../utils/cloudinary.utils.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';
import { getMediaInfoFromUrl } from '../utils/cloudinary.utils.js';
import {
  checkStorageQuota,
  incrementStorageUsage,
  decrementStorageUsage,
} from '../utils/quota.utils.js';
import { createAppError } from '../middleware/error.middleware.js';
import { validateFileSize } from '../middleware/upload.middleware.js';

const ASSET_SELECT = {
  id:                  true,
  type:                true,
  name:                true,
  mimeType:            true,
  cloudinaryUrl:       true,
  cloudinarySecureUrl: true,
  duration:            true,
  fps:                 true,
  width:               true,
  height:              true,
  thumbnailUrl:        true,
  fileSizeMb:          true,
  createdAt:           true,
  updatedAt:           true,
};

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listUserMedia(userId, { page, perPage, type, search, sort, order }) {
  const skip  = (page - 1) * perPage;
  const where = {
    userId,
    deletedAt: null,
    ...(type   && { type }),
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
  };

  const [items, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      select:  ASSET_SELECT,
      orderBy: { [sort]: order },
      skip,
      take: perPage,
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  return { items, total };
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getAssetById(assetId, userId) {
  return prisma.mediaAsset.findFirst({
    where:  { id: assetId, userId, deletedAt: null },
    select: ASSET_SELECT,
  });
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadMediaAsset(user, file) {
  const fileSizeMb = bytesToMb(file.size);

  // 1. Validate per-MIME file size limit
  const sizeCheck = validateFileSize(file.mimetype, file.size);
  if (!sizeCheck.valid) {
    throw createAppError(
      `File exceeds the ${sizeCheck.limitMb}MB limit for this file type`,
      413,
      'FILE_TOO_LARGE'
    );
  }

  // 2. Check storage quota
  const quotaCheck = checkStorageQuota(user, fileSizeMb);
  if (!quotaCheck.allowed) {
    throw createAppError(
      `Storage quota exceeded. You have ${quotaCheck.remainingMb}MB remaining (${quotaCheck.used}MB / ${quotaCheck.limit}MB used).`,
      402,
      'QUOTA_EXCEEDED'
    );
  }

  // 3. Upload to Cloudinary
  const uploadResult = await uploadToCloudinary(
    file.path,
    user.id,
    file.mimetype,
    file.originalname
  );

  const mediaType = mimeToMediaType(file.mimetype);

  // 4. Probe media for video/audio to get duration/fps/dimensions
  let mediaInfo = {};
  if (mediaType === 'VIDEO' || mediaType === 'AUDIO') {
    try {
      mediaInfo = await getMediaInfoFromUrl(uploadResult.secure_url);
    } catch (_) {
      // Non-fatal — media info is best-effort
    }
  }

  // 5. Generate thumbnail for video files
  let thumbnailUrl      = null;
  let thumbnailPublicId = null;

  if (mediaType === 'VIDEO') {
    try {
      const thumb = await generateVideoThumbnail(
        uploadResult.secure_url,
        user.id,
        uploadResult.public_id
      );
      thumbnailUrl      = thumb.url;
      thumbnailPublicId = thumb.publicId;
    } catch (_) {
      // Non-fatal
    }
  }

  // 6. Persist to database
  const asset = await prisma.mediaAsset.create({
    data: {
      userId:              user.id,
      type:                mediaType,
      name:                file.originalname,
      mimeType:            file.mimetype,
      cloudinaryPublicId:  uploadResult.public_id,
      cloudinaryUrl:       uploadResult.url,
      cloudinarySecureUrl: uploadResult.secure_url,
      duration:            mediaInfo.duration    || null,
      fps:                 mediaInfo.fps         || null,
      width:               mediaInfo.width       || null,
      height:              mediaInfo.height      || null,
      thumbnailUrl,
      thumbnailPublicId,
      fileSizeMb,
    },
    select: ASSET_SELECT,
  });

  // 7. Update user storage quota
  await incrementStorageUsage(user.id, fileSizeMb);

  return asset;
}

// ─── Bulk upload ──────────────────────────────────────────────────────────────

export async function uploadBulkMedia(user, files) {
  const succeeded = [];
  const failed    = [];

  for (const file of files) {
    try {
      const asset = await uploadMediaAsset(user, file);
      succeeded.push(asset);
    } catch (err) {
      failed.push({ name: file.originalname, error: err.message });
    }
  }

  return { succeeded, failed };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteAsset(assetId, userId) {
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: assetId, userId, deletedAt: null },
  });
  if (!asset) throw createAppError('Media asset not found', 404, 'NOT_FOUND');

  // Delete from Cloudinary (non-fatal)
  const resourceType = asset.type === 'IMAGE' ? 'image' : 'video';
  await deleteFromCloudinary(asset.cloudinaryPublicId, resourceType).catch(() => null);

  // Delete thumbnail from Cloudinary (non-fatal)
  if (asset.thumbnailPublicId) {
    await deleteFromCloudinary(asset.thumbnailPublicId, 'image').catch(() => null);
  }

  // Soft-delete in DB
  await prisma.mediaAsset.update({
    where: { id: assetId },
    data:  { deletedAt: new Date() },
  });

  // Free up storage quota
  await decrementStorageUsage(userId, asset.fileSizeMb);
}