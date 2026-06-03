// ─────────────────────────────────────────────────────────────────────────────
// src/services/user.service.js
// ─────────────────────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';
import { uploadAvatar as uploadAvatarUtil } from '../utils/cloudinary.utils.js';
import { createAppError } from '../middleware/error.middleware.js';

const USER_SELECT = {
  id:               true,
  email:            true,
  displayName:      true,
  avatarUrl:        true,
  avatarPublicId:   true,
  plan:             true,
  isVerified:       true,
  storageUsedMb:    true,
  exportMinutesUsed: true,
  usageResetAt:     true,
  createdAt:        true,
  updatedAt:        true,
};

export async function getUserById(userId) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: USER_SELECT,
  });
  if (!user) throw createAppError('User not found', 404, 'NOT_FOUND');
  return user;
}

export async function updateUser(userId, updates) {
  const data = {};

  if (updates.displayName) data.displayName = updates.displayName;

  if (updates.email) {
    const conflict = await prisma.user.findFirst({
      where: { email: updates.email, NOT: { id: userId } },
    });
    if (conflict) {
      throw createAppError('Email address is already in use', 409, 'EMAIL_TAKEN');
    }
    data.email      = updates.email;
    data.isVerified = false;
  }

  return prisma.user.update({
    where:  { id: userId },
    data,
    select: USER_SELECT,
  });
}

export async function updateAvatar(userId, localPath, existingPublicId) {
  const result = await uploadAvatarUtil(localPath, userId, existingPublicId);

  return prisma.user.update({
    where: { id: userId },
    data:  {
      avatarUrl:      result.secure_url,
      avatarPublicId: result.public_id,
    },
    select: USER_SELECT,
  });
}

export async function removeAvatar(userId, publicId) {
  if (publicId) {
    await deleteFromCloudinary(publicId, 'image').catch(() => null);
  }

  return prisma.user.update({
    where:  { id: userId },
    data:   { avatarUrl: null, avatarPublicId: null },
    select: USER_SELECT,
  });
}

export async function deleteUserAccount(userId, password) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw createAppError('User not found', 404, 'NOT_FOUND');

  if (user.passwordHash) {
    const bcrypt = await import('bcryptjs');
    const valid  = await bcrypt.default.compare(password, user.passwordHash);
    if (!valid) throw createAppError('Incorrect password', 401, 'INVALID_PASSWORD');
  }

  await prisma.user.delete({ where: { id: userId } });
}