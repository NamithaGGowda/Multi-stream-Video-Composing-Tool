// ─────────────────────────────────────────────────────────────────────────────
// src/workers/export.worker.js
// BullMQ worker for full-timeline export jobs.
// Processes the entire timeline JSON through the ffmpeg pipeline,
// uploads the final video to Cloudinary, and streams real-time
// progress (0–100%) to the client via WebSocket.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { Worker } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { configureFfmpeg, cleanTempFile, getTempDir } from '../config/ffmpeg.js';
import { initCloudinary } from '../config/cloudinary.js';
import { uploadExportStream } from '../utils/cloudinary.utils.js';
import prisma from '../config/db.js';
import { buildExportPipeline } from '../utils/ffmpeg.pipeline.js';
import { broadcastToUser, broadcastToJob, WS_EVENTS } from '../websocket/ws.server.js';
import { incrementExportUsage } from '../utils/quota.utils.js';
import { EXPORT_QUEUE_NAME } from '../queues/export.queue.js';
import fs from 'fs';
import path from 'path';

// Initialise config for standalone worker process
configureFfmpeg();
initCloudinary();

const CONCURRENCY = parseInt(process.env.WORKER_EXPORT_CONCURRENCY || '1', 10);

// ─── Worker ───────────────────────────────────────────────────────────────────

const exportWorker = new Worker(
  EXPORT_QUEUE_NAME,
  async (job) => {
    const { exportJobId, userId, timelineData, exportSettings } = job.data;

    console.log(`[ExportWorker] Starting export job ${job.id} dbId=${exportJobId} user=${userId}`);

    // ── 1. Mark as processing ────────────────────────────────────────────────
    await prisma.exportJob.update({
      where: { id: exportJobId },
      data:  { status: 'PROCESSING', startedAt: new Date(), progress: 0 },
    });

    broadcastToUser(userId, WS_EVENTS.EXPORT_PROGRESS, {
      jobId:    exportJobId,
      progress: 0,
      stage:    'Starting export…',
    });

    let outputPath = null;

    try {
      // ── 2. Build the ffmpeg pipeline ───────────────────────────────────────
      const onProgress = async (pct) => {
        await job.updateProgress(pct);

        // Update DB progress every 5% to avoid excessive writes
        if (pct % 5 === 0 || pct === 100) {
          await prisma.exportJob.update({
            where: { id: exportJobId },
            data:  { progress: pct },
          });
        }

        // Always broadcast progress over WebSocket
        broadcastToUser(userId, WS_EVENTS.EXPORT_PROGRESS, {
          jobId:    exportJobId,
          progress: pct,
          stage:    getStageLabel(pct),
        });

        broadcastToJob(exportJobId, WS_EVENTS.EXPORT_PROGRESS, {
          jobId:    exportJobId,
          progress: pct,
        });
      };

      outputPath = await buildExportPipeline({
        timelineData,
        exportSettings,
        onProgress,
      });

      console.log(`[ExportWorker] Pipeline complete. Output file: ${outputPath}`);

      // ── 3. Upload to Cloudinary ────────────────────────────────────────────
      broadcastToUser(userId, WS_EVENTS.EXPORT_PROGRESS, {
        jobId:    exportJobId,
        progress: 97,
        stage:    'Uploading to cloud…',
      });

      const format = (exportSettings.format || 'MP4').toLowerCase();
      const { stream: uploadStream, result: uploadResultPromise } =
        uploadExportStream(userId, exportJobId, format);

      // Pipe the output file into the Cloudinary upload stream
      await new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(outputPath);
        fileStream.on('error', reject);
        uploadStream.on('error', reject);
        uploadStream.on('finish', resolve);
        fileStream.pipe(uploadStream);
      });

      const uploadResult = await uploadResultPromise;
      console.log(`[ExportWorker] Upload complete: ${uploadResult.secure_url}`);

      // ── 4. Get output file size ────────────────────────────────────────────
      const stats = fs.statSync(outputPath);
      const outputSizeMb = Math.round((stats.size / (1024 * 1024)) * 100) / 100;

      // ── 5. Mark completed in DB ────────────────────────────────────────────
      const completedJob = await prisma.exportJob.update({
        where: { id: exportJobId },
        data:  {
          status:          'COMPLETED',
          progress:        100,
          completedAt:     new Date(),
          outputUrl:       uploadResult.secure_url,
          outputPublicId:  uploadResult.public_id,
          outputSizeMb,
          durationSeconds: uploadResult.duration || null,
        },
      });

      // ── 6. Update user export minutes quota ────────────────────────────────
      const durationMinutes = (uploadResult.duration || 0) / 60;
      if (durationMinutes > 0) {
        await incrementExportUsage(userId, durationMinutes).catch(() => null);
      }

      // ── 7. Notify client ───────────────────────────────────────────────────
      broadcastToUser(userId, WS_EVENTS.EXPORT_COMPLETE, {
        jobId:      exportJobId,
        progress:   100,
        outputUrl:  uploadResult.secure_url,
        sizeMb:     outputSizeMb,
        duration:   uploadResult.duration,
      });

      broadcastToJob(exportJobId, WS_EVENTS.EXPORT_COMPLETE, {
        jobId:     exportJobId,
        outputUrl: uploadResult.secure_url,
      });

      console.log(`[ExportWorker] Job ${job.id} completed successfully.`);
      return { outputUrl: uploadResult.secure_url, sizeMb: outputSizeMb };

    } catch (err) {
      console.error(`[ExportWorker] Job ${job.id} failed:`, err.message);

      await prisma.exportJob.update({
        where: { id: exportJobId },
        data:  {
          status:       'FAILED',
          errorMessage: err.message,
          errorStack:   process.env.NODE_ENV !== 'production' ? err.stack : null,
          completedAt:  new Date(),
        },
      });

      broadcastToUser(userId, WS_EVENTS.EXPORT_FAILED, {
        jobId:   exportJobId,
        error:   err.message,
      });

      broadcastToJob(exportJobId, WS_EVENTS.EXPORT_FAILED, {
        jobId:  exportJobId,
        error:  err.message,
      });

      throw err; // Let BullMQ handle retry

    } finally {
      // Clean up temp output file regardless of success or failure
      if (outputPath) cleanTempFile(outputPath);
    }
  },
  {
    connection:  createRedisConnection(),
    concurrency: CONCURRENCY,
    // Extend lock time for long exports (default 30s is too short for large files)
    lockDuration:    5 * 60 * 1000, // 5 minutes
    lockRenewTime:   2 * 60 * 1000, // Renew every 2 minutes
  }
);

// ─── Stage labels for progress reporting ─────────────────────────────────────

function getStageLabel(pct) {
  if (pct < 5)   return 'Preparing export…';
  if (pct < 40)  return 'Processing video clips…';
  if (pct < 65)  return 'Encoding audio tracks…';
  if (pct < 75)  return 'Merging clips…';
  if (pct < 95)  return 'Applying final encode…';
  if (pct < 99)  return 'Uploading to cloud…';
  return 'Finalising…';
}

// ─── Worker event listeners ───────────────────────────────────────────────────

exportWorker.on('completed', (job, result) => {
  console.log(`[ExportWorker] Job ${job.id} done. Output: ${result?.outputUrl}`);
});

exportWorker.on('failed', (job, err) => {
  console.error(`[ExportWorker] Job ${job?.id} failed permanently: ${err.message}`);
});

exportWorker.on('error', (err) => {
  console.error('[ExportWorker] Worker error:', err.message);
});

exportWorker.on('stalled', (jobId) => {
  console.warn(`[ExportWorker] Job ${jobId} stalled — likely a crash mid-export`);
});

exportWorker.on('active', (job) => {
  console.log(`[ExportWorker] Job ${job.id} is now active`);
});

console.log(
  `[ExportWorker] Started. Queue: ${EXPORT_QUEUE_NAME}, concurrency: ${CONCURRENCY}`
);

export default exportWorker;