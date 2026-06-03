// ─────────────────────────────────────────────────────────────────────────────
// src/workers/ai.worker.js
// BullMQ worker for all AI feature jobs.
// Routes jobs to the correct AI handler (caption, background removal, etc.)
// Each handler is a stub with a clear TODO marking where the AI SDK goes.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { Worker } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { initCloudinary } from '../config/cloudinary.js';
import prisma from '../config/db.js';
import { broadcastToUser, WS_EVENTS } from '../websocket/ws.server.js';
import { AI_QUEUE_NAME } from '../queues/ai.queue.js';

// Import pluggable AI handlers
import { runCaptionJob }             from '../ai/caption.ai.js';
import { runBackgroundRemovalJob }   from '../ai/backgroundRemoval.ai.js';
import { runNoiseSuppressionJob }    from '../ai/noiseSuppression.ai.js';
import { runSmartCutJob }            from '../ai/smartCut.ai.js';

initCloudinary();

const CONCURRENCY = parseInt(process.env.WORKER_AI_CONCURRENCY || '2', 10);

// ─── Job router ───────────────────────────────────────────────────────────────

/**
 * Route an AI job to the correct handler based on its type.
 *
 * @param {string}   type         - AIJobType enum value
 * @param {object}   inputParams  - Job-specific parameters
 * @param {function} onProgress   - Progress reporter (0–100)
 * @returns {Promise<object>}     - Output data to store on the AIJob record
 */
async function routeAIJob(type, inputParams, onProgress) {
  switch (type) {
    case 'AUTO_CAPTION':
      return runCaptionJob(inputParams, onProgress);

    case 'BACKGROUND_REMOVAL':
      return runBackgroundRemovalJob(inputParams, onProgress);

    case 'NOISE_SUPPRESSION':
      return runNoiseSuppressionJob(inputParams, onProgress);

    case 'SMART_CUT':
      return runSmartCutJob(inputParams, onProgress);

    default:
      throw new Error(`Unknown AI job type: ${type}`);
  }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

const aiWorker = new Worker(
  AI_QUEUE_NAME,
  async (job) => {
    const { aiJobId, userId, type, inputParams } = job.data;

    console.log(`[AIWorker] Starting job ${job.id} type=${type} dbId=${aiJobId}`);

    // ── 1. Mark as processing ────────────────────────────────────────────────
    await prisma.aIJob.update({
      where: { id: aiJobId },
      data:  { status: 'PROCESSING', startedAt: new Date(), progress: 0 },
    });

    broadcastToUser(userId, WS_EVENTS.AI_JOB_PROGRESS, {
      jobId:    aiJobId,
      type,
      progress: 0,
    });

    try {
      // ── 2. Progress reporter ───────────────────────────────────────────────
      const onProgress = async (pct) => {
        await job.updateProgress(pct);

        if (pct % 10 === 0 || pct === 100) {
          await prisma.aIJob.update({
            where: { id: aiJobId },
            data:  { progress: pct },
          });
        }

        broadcastToUser(userId, WS_EVENTS.AI_JOB_PROGRESS, {
          jobId:    aiJobId,
          type,
          progress: pct,
        });
      };

      // ── 3. Run the AI handler ──────────────────────────────────────────────
      const outputData = await routeAIJob(type, inputParams, onProgress);

      // ── 4. Mark completed ──────────────────────────────────────────────────
      await prisma.aIJob.update({
        where: { id: aiJobId },
        data:  {
          status:        'COMPLETED',
          progress:      100,
          outputData,
          resultMessage: outputData?.message || `${type} completed successfully`,
          completedAt:   new Date(),
        },
      });

      broadcastToUser(userId, WS_EVENTS.AI_JOB_COMPLETE, {
        jobId:      aiJobId,
        type,
        outputData,
        progress:   100,
      });

      console.log(`[AIWorker] Job ${job.id} (${type}) completed`);
      return outputData;

    } catch (err) {
      console.error(`[AIWorker] Job ${job.id} (${type}) failed:`, err.message);

      await prisma.aIJob.update({
        where: { id: aiJobId },
        data:  {
          status:       'FAILED',
          errorMessage: err.message,
          completedAt:  new Date(),
        },
      });

      broadcastToUser(userId, WS_EVENTS.AI_JOB_FAILED, {
        jobId:  aiJobId,
        type,
        error:  err.message,
      });

      throw err;
    }
  },
  {
    connection:  createRedisConnection(),
    concurrency: CONCURRENCY,
    lockDuration: 10 * 60 * 1000, // 10 minutes for slow AI API calls
    lockRenewTime: 4 * 60 * 1000,
  }
);

// ─── Worker event listeners ───────────────────────────────────────────────────

aiWorker.on('completed', (job) => {
  console.log(`[AIWorker] Job ${job.id} (${job.name}) done`);
});

aiWorker.on('failed', (job, err) => {
  console.error(`[AIWorker] Job ${job?.id} (${job?.name}) failed permanently: ${err.message}`);
});

aiWorker.on('error', (err) => {
  console.error('[AIWorker] Worker error:', err.message);
});

aiWorker.on('stalled', (jobId) => {
  console.warn(`[AIWorker] Job ${jobId} stalled`);
});

console.log(`[AIWorker] Started. Queue: ${AI_QUEUE_NAME}, concurrency: ${CONCURRENCY}`);

export default aiWorker;