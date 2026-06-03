// ─────────────────────────────────────────────────────────────────────────────
// src/services/timeline.service.js
// ─────────────────────────────────────────────────────────────────────────────

import prisma from '../config/db.js';
import { createAppError } from '../middleware/error.middleware.js';

const MAX_VERSIONS = 10;

export async function getTimeline(projectId, userId) {
  return prisma.project.findFirst({
    where:  { id: projectId, userId, deletedAt: null },
    select: {
      id:           true,
      title:        true,
      timelineData: true,
      updatedAt:    true,
    },
  });
}

export async function saveTimeline(projectId, userId, timelineData, label = 'Auto-save') {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
  });
  if (!project) throw createAppError('Project not found', 404, 'NOT_FOUND');

  // Get next version number
  const lastVersion = await prisma.timelineVersion.findFirst({
    where:   { projectId },
    orderBy: { versionNumber: 'desc' },
    select:  { versionNumber: true },
  });
  const versionNumber = (lastVersion?.versionNumber || 0) + 1;

  // Run update + version creation in a transaction
  const [updated, version] = await prisma.$transaction([
    // Update the live timeline on the project
    prisma.project.update({
      where:  { id: projectId },
      data:   { timelineData },
      select: { id: true, updatedAt: true },
    }),
    // Create version snapshot
    prisma.timelineVersion.create({
      data: {
        projectId,
        versionNumber,
        label,
        timelineData,
      },
      select: {
        id:            true,
        versionNumber: true,
        label:         true,
        createdAt:     true,
      },
    }),
  ]);

  // Prune old versions (keep only last MAX_VERSIONS)
  const allVersions = await prisma.timelineVersion.findMany({
    where:   { projectId },
    orderBy: { versionNumber: 'asc' },
    select:  { id: true },
  });
  if (allVersions.length > MAX_VERSIONS) {
    const toDelete = allVersions.slice(0, allVersions.length - MAX_VERSIONS).map((v) => v.id);
    await prisma.timelineVersion.deleteMany({ where: { id: { in: toDelete } } });
  }

  return { project: updated, version };
}

export async function getVersionHistory(projectId, userId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
  });
  if (!project) throw createAppError('Project not found', 404, 'NOT_FOUND');

  return prisma.timelineVersion.findMany({
    where:   { projectId },
    select:  {
      id:            true,
      versionNumber: true,
      label:         true,
      createdAt:     true,
      // Intentionally omit timelineData from the list — it's large
    },
    orderBy: { versionNumber: 'desc' },
  });
}

export async function restoreVersion(projectId, versionId, userId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
  });
  if (!project) throw createAppError('Project not found', 404, 'NOT_FOUND');

  const version = await prisma.timelineVersion.findFirst({
    where: { id: versionId, projectId },
  });
  if (!version) throw createAppError('Version not found', 404, 'NOT_FOUND');

  // Save current state as a new "Before restore" version, then apply
  await saveTimeline(projectId, userId, project.timelineData, 'Before restore');

  const updated = await prisma.project.update({
    where:  { id: projectId },
    data:   { timelineData: version.timelineData },
    select: { id: true, timelineData: true, updatedAt: true },
  });

  return { project: updated, restoredFrom: version.versionNumber };
}