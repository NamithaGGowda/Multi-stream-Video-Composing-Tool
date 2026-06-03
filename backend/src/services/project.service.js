// ─────────────────────────────────────────────────────────────────────────────
// src/services/project.service.js
// ─────────────────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/db.js';
import { uploadProjectThumbnail } from '../utils/cloudinary.utils.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';
import { createAppError } from '../middleware/error.middleware.js';

const PROJECT_SELECT = {
  id:               true,
  title:            true,
  description:      true,
  resolution:       true,
  fps:              true,
  duration:         true,
  aspectRatio:      true,
  thumbnailUrl:     true,
  thumbnailPublicId: true,
  timelineData:     true,
  createdAt:        true,
  updatedAt:        true,
};

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listUserProjects(userId, { page, perPage, sort, order, search }) {
  const skip  = (page - 1) * perPage;
  const where = {
    userId,
    deletedAt: null,
    ...(search && {
      title: { contains: search, mode: 'insensitive' },
    }),
  };

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      select: { ...PROJECT_SELECT, timelineData: false }, // omit heavy blob from list
      orderBy: { [sort]: order },
      skip,
      take: perPage,
    }),
    prisma.project.count({ where }),
  ]);

  return { items, total };
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getProjectById(projectId, userId) {
  const project = await prisma.project.findFirst({
    where:  { id: projectId, userId, deletedAt: null },
    select: PROJECT_SELECT,
  });
  return project; // null if not found
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createProject(userId, data) {
  return prisma.project.create({
    data: {
      userId,
      title:       data.title       || 'Untitled Project',
      resolution:  data.resolution  || '1920x1080',
      fps:         parseInt(data.fps || 30),
      aspectRatio: data.aspectRatio || '16:9',
      timelineData: {
        tracks:      [],
        clips:       [],
        transitions: [],
      },
    },
    select: PROJECT_SELECT,
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateProject(projectId, userId, updates) {
  // Verify ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
  });
  if (!project) throw createAppError('Project not found', 404, 'NOT_FOUND');

  const data = {};
  if (updates.title       !== undefined) data.title       = updates.title;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.resolution  !== undefined) data.resolution  = updates.resolution;
  if (updates.fps         !== undefined) data.fps         = parseInt(updates.fps);
  if (updates.duration    !== undefined) data.duration    = parseFloat(updates.duration);
  if (updates.aspectRatio !== undefined) data.aspectRatio = updates.aspectRatio;

  return prisma.project.update({
    where:  { id: projectId },
    data,
    select: PROJECT_SELECT,
  });
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────

export async function deleteProject(projectId, userId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
  });
  if (!project) throw createAppError('Project not found', 404, 'NOT_FOUND');

  await prisma.project.update({
    where: { id: projectId },
    data:  { deletedAt: new Date() },
  });
}

// ─── Duplicate ────────────────────────────────────────────────────────────────

export async function duplicateProject(projectId, userId) {
  const original = await prisma.project.findFirst({
    where:  { id: projectId, userId, deletedAt: null },
    select: PROJECT_SELECT,
  });
  if (!original) throw createAppError('Project not found', 404, 'NOT_FOUND');

  return prisma.project.create({
    data: {
      userId,
      title:        `Copy of ${original.title}`,
      description:  original.description,
      resolution:   original.resolution,
      fps:          original.fps,
      duration:     original.duration,
      aspectRatio:  original.aspectRatio,
      timelineData: original.timelineData || {},
      // Don't copy thumbnail — it's tied to the original
    },
    select: PROJECT_SELECT,
  });
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────

export async function updateProjectThumbnail(projectId, userId, localPath) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
  });
  if (!project) throw createAppError('Project not found', 404, 'NOT_FOUND');

  const result = await uploadProjectThumbnail(
    localPath,
    userId,
    projectId,
    project.thumbnailPublicId
  );

  return prisma.project.update({
    where:  { id: projectId },
    data:   { thumbnailUrl: result.secure_url, thumbnailPublicId: result.public_id },
    select: PROJECT_SELECT,
  });
}