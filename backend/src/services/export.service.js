// ─────────────────────────────────────────────────────────────────────────────
// src/services/export.service.js
// ─────────────────────────────────────────────────────────────────────────────

import prisma from '../config/db.js';
import { getExportQueue } from '../queues/export.queue.js';
import { checkExportQuota } from '../utils/quota.utils.js';
import { createAppError } from '../middleware/error.middleware.js';

const JOB_SELECT = {
  id:               true,
  projectId:        true,
  bullJobId:        true,
  status:           true,
  progress:         true,
  format:           true,
  resolution:       true,
  fps:              true,
  quality:          true,
  codec:            true,
  audioBitrate:     true,
  outputUrl:        true,
  outputSizeMb:     true,
  durationSeconds:  true,
  errorMessage:     true,
  startedAt:        true,
  completedAt:      true,
  createdAt:        true,
  updatedAt:        true,
};

export async function queueExportJob(user, settings) {
  // 1. Load project + timeline
  const project = await prisma.project.findFirst({
    where: { id: settings.projectId, userId: user.id, deletedAt: null },
  });
  if (!project) throw createAppError('Project not found', 404, 'NOT_FOUND');

  // 2. Check export quota (duration in minutes)
  const durationMinutes = (project.duration || 0) / 60;
  const quotaCheck = checkExportQuota(user, durationMinutes);
  if (!quotaCheck.allowed) {
    throw createAppError(
      `Export quota exceeded. You have ${quotaCheck.remaining} minutes remaining this month.`,
      402,
      'QUOTA_EXCEEDED'
    );
  }

  // 3. Create export job record
  const exportJob = await prisma.exportJob.create({
    data: {
      userId:           user.id,
      projectId:        project.id,
      status:           'PENDING',
      format:           settings.format      || 'MP4',
      resolution:       settings.resolution  || 'R_1080P',
      fps:              parseInt(settings.fps || 30),
      quality:          settings.quality     || 'high',
      codec:            settings.codec       || 'H.264',
      audioBitrate:     settings.audioBitrate || '192k',
      timelineSnapshot: project.timelineData,
    },
    select: JOB_SELECT,
  });

  // 4. Push to BullMQ export queue
  const queue     = getExportQueue();
  const bullJob   = await queue.add(
    'export',
    {
      exportJobId:    exportJob.id,
      userId:         user.id,
      timelineData:   project.timelineData,
      exportSettings: {
        format:      exportJob.format,
        resolution:  exportJob.resolution,
        fps:         exportJob.fps,
        quality:     exportJob.quality,
        codec:       exportJob.codec,
        audioBitrate: exportJob.audioBitrate,
      },
    },
    {
      attempts:    3,
      backoff:     { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 50 },
      removeOnFail:     { count: 100 },
    }
  );

  // 5. Store BullMQ job ID for progress lookup
  await prisma.exportJob.update({
    where: { id: exportJob.id },
    data:  { bullJobId: String(bullJob.id) },
  });

  return { ...exportJob, bullJobId: String(bullJob.id) };
}

export async function getExportJob(jobId, userId) {
  return prisma.exportJob.findFirst({
    where:  { id: jobId, userId },
    select: JOB_SELECT,
  });
}

export async function listExportJobs(userId, { page, perPage, projectId, status }) {
  const skip  = (page - 1) * perPage;
  const where = {
    userId,
    ...(projectId && { projectId }),
    ...(status    && { status }),
  };

  const [items, total] = await Promise.all([
    prisma.exportJob.findMany({
      where,
      select:  JOB_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: perPage,
    }),
    prisma.exportJob.count({ where }),
  ]);

  return { items, total };
}

export async function cancelExportJob(jobId, userId) {
  const job = await prisma.exportJob.findFirst({
    where: { id: jobId, userId },
  });
  if (!job) throw createAppError('Export job not found', 404, 'NOT_FOUND');
  if (!['PENDING', 'PROCESSING'].includes(job.status)) {
    throw createAppError('Only pending or processing jobs can be cancelled', 400, 'INVALID_STATE');
  }

  // Remove from BullMQ if job is queued
  if (job.bullJobId) {
    try {
      const queue   = getExportQueue();
      const bullJob = await queue.getJob(job.bullJobId);
      if (bullJob) await bullJob.remove();
    } catch (_) { /* non-fatal */ }
  }

  await prisma.exportJob.update({
    where: { id: jobId },
    data:  { status: 'CANCELLED' },
  });
}