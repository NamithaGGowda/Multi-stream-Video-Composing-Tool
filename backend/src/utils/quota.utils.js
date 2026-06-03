// ─────────────────────────────────────────────────────────────────────────────
// src/utils/quota.utils.js
// Usage quota checking and tracking helpers.
// Free plan limits are enforced before uploads and exports.
// ─────────────────────────────────────────────────────────────────────────────

import prisma from '../config/db.js';

// ─── Plan limits ──────────────────────────────────────────────────────────────

/**
 * Returns the quota limits for a given plan.
 * 0 means unlimited (pro plan).
 *
 * @param {'FREE'|'PRO'} plan
 * @returns {{ maxStorageMb: number, maxExportMinutes: number }}
 */
export function getPlanLimits(plan) {
  if (plan === 'PRO') {
    return {
      maxStorageMb:      parseInt(process.env.QUOTA_PRO_STORAGE_MB      || '0', 10),
      maxExportMinutes:  parseInt(process.env.QUOTA_PRO_EXPORT_MINUTES   || '0', 10),
    };
  }

  return {
    maxStorageMb:     parseInt(process.env.QUOTA_FREE_STORAGE_MB     || '500',  10),
    maxExportMinutes: parseInt(process.env.QUOTA_FREE_EXPORT_MINUTES  || '30',   10),
  };
}

// ─── Storage quota ────────────────────────────────────────────────────────────

/**
 * Check whether a user has enough storage quota for a new upload.
 *
 * @param {object} user           - Prisma User object
 * @param {number} fileSizeMb     - Size of the file about to be uploaded
 * @returns {{ allowed: boolean, used: number, limit: number, remaining: number }}
 */
export function checkStorageQuota(user, fileSizeMb) {
  const { maxStorageMb } = getPlanLimits(user.plan);

  // 0 = unlimited
  if (maxStorageMb === 0) {
    return { allowed: true, used: user.storageUsedMb, limit: 0, remaining: Infinity };
  }

  const remaining = maxStorageMb - user.storageUsedMb;
  const allowed   = remaining >= fileSizeMb;

  return {
    allowed,
    used:      Math.round(user.storageUsedMb * 100) / 100,
    limit:     maxStorageMb,
    remaining: Math.max(0, Math.round(remaining * 100) / 100),
  };
}

/**
 * Increment the user's storage usage in the database.
 *
 * @param {string} userId
 * @param {number} deltaMb  - Positive to add, negative to subtract
 * @returns {Promise<void>}
 */
export async function incrementStorageUsage(userId, deltaMb) {
  await prisma.user.update({
    where: { id: userId },
    data:  {
      storageUsedMb: {
        increment: deltaMb,
      },
    },
  });
}

/**
 * Decrement the user's storage usage (called on asset deletion).
 *
 * @param {string} userId
 * @param {number} fileSizeMb
 * @returns {Promise<void>}
 */
export async function decrementStorageUsage(userId, fileSizeMb) {
  // Use increment with a negative value; clamp to 0 via raw SQL
  await prisma.$executeRaw`
    UPDATE users
    SET "storageUsedMb" = GREATEST(0, "storageUsedMb" - ${fileSizeMb})
    WHERE id = ${userId}
  `;
}

// ─── Export minutes quota ─────────────────────────────────────────────────────

/**
 * Check whether a user has enough export minutes remaining.
 *
 * @param {object} user           - Prisma User object
 * @param {number} durationMinutes - Duration of the project being exported
 * @returns {{ allowed: boolean, used: number, limit: number, remaining: number }}
 */
export function checkExportQuota(user, durationMinutes) {
  const { maxExportMinutes } = getPlanLimits(user.plan);

  if (maxExportMinutes === 0) {
    return { allowed: true, used: user.exportMinutesUsed, limit: 0, remaining: Infinity };
  }

  const remaining = maxExportMinutes - user.exportMinutesUsed;
  const allowed   = remaining >= durationMinutes;

  return {
    allowed,
    used:      Math.round(user.exportMinutesUsed * 100) / 100,
    limit:     maxExportMinutes,
    remaining: Math.max(0, Math.round(remaining * 100) / 100),
  };
}

/**
 * Increment the user's export minutes usage in the database.
 *
 * @param {string} userId
 * @param {number} durationMinutes
 * @returns {Promise<void>}
 */
export async function incrementExportUsage(userId, durationMinutes) {
  await prisma.user.update({
    where: { id: userId },
    data:  {
      exportMinutesUsed: {
        increment: durationMinutes,
      },
    },
  });
}

// ─── Monthly reset ────────────────────────────────────────────────────────────

/**
 * Reset monthly usage counters for a single user.
 * Called by a scheduled cron job or manually.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function resetMonthlyUsage(userId) {
  await prisma.user.update({
    where: { id: userId },
    data:  {
      exportMinutesUsed: 0,
      usageResetAt:      new Date(),
    },
  });
}

/**
 * Reset monthly usage for all users whose reset date has passed.
 * Intended to be called by a daily cron job.
 *
 * @returns {Promise<number>} Number of users reset
 */
export async function resetAllExpiredUsage() {
  const now = new Date();
  // Reset users whose usageResetAt is more than 30 days ago
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const result = await prisma.user.updateMany({
    where: {
      usageResetAt: { lt: thirtyDaysAgo },
    },
    data: {
      exportMinutesUsed: 0,
      usageResetAt:      now,
    },
  });

  return result.count;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * Build a full quota summary object for the current user.
 * Returned in the /api/users/me and /api/users/quota endpoints.
 *
 * @param {object} user  - Prisma User object
 * @returns {object}
 */
export function buildQuotaSummary(user) {
  const limits    = getPlanLimits(user.plan);
  const storageQ  = checkStorageQuota(user, 0);
  const exportQ   = checkExportQuota(user, 0);

  return {
    plan: user.plan,
    storage: {
      usedMb:      storageQ.used,
      limitMb:     limits.maxStorageMb,
      remainingMb: storageQ.remaining === Infinity ? null : storageQ.remaining,
      unlimited:   limits.maxStorageMb === 0,
      percentUsed:
        limits.maxStorageMb > 0
          ? Math.round((user.storageUsedMb / limits.maxStorageMb) * 100)
          : 0,
    },
    exportMinutes: {
      used:        exportQ.used,
      limit:       limits.maxExportMinutes,
      remaining:   exportQ.remaining === Infinity ? null : exportQ.remaining,
      unlimited:   limits.maxExportMinutes === 0,
      percentUsed:
        limits.maxExportMinutes > 0
          ? Math.round((user.exportMinutesUsed / limits.maxExportMinutes) * 100)
          : 0,
    },
    usageResetAt: user.usageResetAt,
  };
}