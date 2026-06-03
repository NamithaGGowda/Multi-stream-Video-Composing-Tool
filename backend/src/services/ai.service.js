// ─────────────────────────────────────────────────────────────────────────────
// src/services/ai.service.js
// Stub AI service — routes jobs to the correct BullMQ queue.
// Each AI type has a clear TODO marking where the AI SDK call will go.
// ─────────────────────────────────────────────────────────────────────────────

import prisma from '../config/db.js';
import { getAIQueue } from '../queues/ai.queue.js';
import { createAppError } from '../middleware/error.middleware.js';

const JOB_SELECT = {
  id:            true,
  type:          true,
  status:        true,
  progress:      true,
  inputParams:   true,
  outputData:    true,
  resultMessage: true,
  errorMessage:  true,
  startedAt:     true,
  completedAt:   true,
  createdAt:     true,
};

export async function queueAIJob(userId, type, inputParams) {
  // Validate that the referenced media asset belongs to the user
  if (inputParams.mediaAssetId) {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: inputParams.mediaAssetId, userId, deletedAt: null },
    });
    if (!asset) throw createAppError('Media asset not found', 404, 'NOT_FOUND');
  }

  const aiJob = await prisma.aIJob.create({
    data: { userId, type, inputParams },
    select: JOB_SELECT,
  });

  const queue   = getAIQueue();
  const bullJob = await queue.add(
    type.toLowerCase(),
    { aiJobId: aiJob.id, userId, type, inputParams },
    {
      attempts: 2,
      backoff:  { type: 'fixed', delay: 10000 },
      removeOnComplete: { count: 100 },
      removeOnFail:     { count: 100 },
    }
  );

  await prisma.aIJob.update({
    where: { id: aiJob.id },
    data:  { bullJobId: String(bullJob.id) },
  });

  return { ...aiJob, bullJobId: String(bullJob.id) };
}

export async function getAIJob(jobId, userId) {
  return prisma.aIJob.findFirst({
    where:  { id: jobId, userId },
    select: JOB_SELECT,
  });
}

export async function listAIJobs(userId, { page, perPage, type, status }) {
  const skip  = (page - 1) * perPage;
  const where = {
    userId,
    ...(type   && { type }),
    ...(status && { status }),
  };

  const [items, total] = await Promise.all([
    prisma.aIJob.findMany({
      where,
      select:  JOB_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: perPage,
    }),
    prisma.aIJob.count({ where }),
  ]);

  return { items, total };
}

export async function cancelAIJob(jobId, userId) {
  const job = await prisma.aIJob.findFirst({ where: { id: jobId, userId } });
  if (!job) throw createAppError('AI job not found', 404, 'NOT_FOUND');
  if (!['PENDING', 'PROCESSING'].includes(job.status)) {
    throw createAppError('Only pending or processing jobs can be cancelled', 400, 'INVALID_STATE');
  }

  if (job.bullJobId) {
    try {
      const queue   = getAIQueue();
      const bullJob = await queue.getJob(job.bullJobId);
      if (bullJob) await bullJob.remove();
    } catch (_) { /* non-fatal */ }
  }

  await prisma.aIJob.update({
    where: { id: jobId },
    data:  { status: 'CANCELLED' },
  });
}