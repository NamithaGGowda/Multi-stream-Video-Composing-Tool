// ─────────────────────────────────────────────────────────────────────────────
// src/workers/video.worker.js
// BullMQ worker for individual video processing jobs.
// Handles: trim, merge, filter, speed, text overlay, audio mix,
//          transition (stub), reverse.
// On completion, uploads the result to Cloudinary and updates the DB record.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { Worker } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { configureFfmpeg, cleanTempFile } from '../config/ffmpeg.js';
import { initCloudinary, uploadToCloudinary, getFolder } from '../config/cloudinary.js';
import prisma from '../config/db.js';
import {
  trimClip,
  mergeClips,
  applyFilter,
  changeSpeed,
  reverseClip,
  addTextOverlay,
  mixAudio,
} from '../utils/ffmpeg.pipeline.js';
import { broadcastToUser, broadcastToJob, WS_EVENTS } from '../websocket/ws.server.js';
import { VIDEO_QUEUE_NAME } from '../queues/video.queue.js';

// Initialise config for standalone worker process
configureFfmpeg();
initCloudinary();

const CONCURRENCY = parseInt(process.env.WORKER_VIDEO_CONCURRENCY || '2', 10);

// ─── Job processor ────────────────────────────────────────────────────────────

/**
 * Process a video job based on its type.
 * Returns the local output file path.
 *
 * @param {string} jobType
 * @param {object} data     - Job payload
 * @param {function} onProgress
 * @returns {Promise<string>}  Local output file path
 */
async function processVideoJob(jobType, data, onProgress) {
  switch (jobType) {

    case 'trim':
      return trimClip({
        inputUrl:   data.inputUrl,
        startSecs:  data.startSecs,
        endSecs:    data.endSecs,
        format:     data.format    || 'mp4',
        onProgress,
      });

    case 'merge':
      return mergeClips({
        inputUrls:  data.inputUrls,
        format:     data.format  || 'mp4',
        quality:    data.quality || 'high',
        onProgress,
      });

    case 'filter':
      return applyFilter({
        inputUrl:     data.inputUrl,
        colorGrade:   data.colorGrade   || {},
        filterPreset: data.filterPreset || null,
        format:       data.format       || 'mp4',
        quality:      data.quality      || 'high',
        onProgress,
      });

    case 'speed':
      return changeSpeed({
        inputUrl:   data.inputUrl,
        speed:      data.speed,
        keepAudio:  data.keepAudio !== false,
        format:     data.format  || 'mp4',
        quality:    data.quality || 'medium',
        onProgress,
      });

    case 'reverse':
      return reverseClip({
        inputUrl:     data.inputUrl,
        reverseAudio: data.reverseAudio !== false,
        format:       data.format  || 'mp4',
        quality:      data.quality || 'medium',
        onProgress,
      });

    case 'text':
      return addTextOverlay({
        inputUrl:   data.inputUrl,
        text:       data.text,
        style:      data.style || {},
        format:     data.format  || 'mp4',
        quality:    data.quality || 'high',
        onProgress,
      });

    case 'audio':
      return mixAudio({
        videoUrl:    data.videoUrl,
        audioUrl:    data.audioUrl,
        videoVolume: data.videoVolume ?? 1.0,
        audioVolume: data.audioVolume ?? 0.8,
        fadeInSecs:  data.fadeInSecs  ?? 0,
        fadeOutSecs: data.fadeOutSecs ?? 0,
        format:      data.format  || 'mp4',
        quality:     data.quality || 'high',
        onProgress,
      });

    case 'transition':
      // TODO: Implement transition filter (xfade) between two clips
      // For now, fall back to a simple merge
      console.warn('[VideoWorker] Transition job not yet implemented — falling back to merge');
      return mergeClips({
        inputUrls:  [data.clipAUrl, data.clipBUrl],
        format:     data.format  || 'mp4',
        quality:    data.quality || 'high',
        onProgress,
      });

    default:
      throw new Error(`Unknown video job type: ${jobType}`);
  }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

const videoWorker = new Worker(
  VIDEO_QUEUE_NAME,
  async (job) => {
    const { videoJobId, userId } = job.data;
    const jobType = job.name;

    console.log(`[VideoWorker] Starting job ${job.id} type=${jobType} dbId=${videoJobId}`);

    // Mark job as processing in DB
    await prisma.videoJob.update({
      where: { id: videoJobId },
      data:  { status: 'PROCESSING', startedAt: new Date() },
    });

    let outputPath = null;

    try {
      // Progress reporter — updates job progress in BullMQ + broadcasts over WS
      const onProgress = async (pct) => {
        await job.updateProgress(pct);
        await prisma.videoJob.update({
          where: { id: videoJobId },
          data:  { progress: pct },
        });
        broadcastToJob(videoJobId, WS_EVENTS.VIDEO_JOB_DONE, { jobId: videoJobId, progress: pct });
      };

      // Run the ffmpeg pipeline
      outputPath = await processVideoJob(jobType, job.data, onProgress);

      // Upload result to Cloudinary
      const userId_  = job.data.userId;
      const folder   = getFolder(userId_, 'videos');
      const uploadResult = await uploadToCloudinary(outputPath, {
        folder,
        resource_type: 'video',
        tags: [`user_${userId_}`, `job_${jobType}`],
      });

      // Mark complete in DB
      await prisma.videoJob.update({
        where: { id: videoJobId },
        data:  {
          status:                  'COMPLETED',
          progress:                100,
          completedAt:             new Date(),
          outputCloudinaryPublicId: uploadResult.public_id,
          outputCloudinaryUrl:      uploadResult.secure_url,
        },
      });

      // Notify client via WebSocket
      broadcastToUser(userId, WS_EVENTS.VIDEO_JOB_DONE, {
        jobId:      videoJobId,
        type:       jobType,
        outputUrl:  uploadResult.secure_url,
        progress:   100,
      });

      console.log(`[VideoWorker] Job ${job.id} completed. Output: ${uploadResult.secure_url}`);

      return { outputUrl: uploadResult.secure_url };

    } catch (err) {
      console.error(`[VideoWorker] Job ${job.id} failed:`, err.message);

      await prisma.videoJob.update({
        where: { id: videoJobId },
        data:  {
          status:       'FAILED',
          errorMessage: err.message,
          completedAt:  new Date(),
        },
      });

      broadcastToUser(userId, WS_EVENTS.VIDEO_JOB_FAILED, {
        jobId:   videoJobId,
        type:    jobType,
        error:   err.message,
      });

      throw err; // Re-throw so BullMQ marks job as failed and retries

    } finally {
      // Always clean up the temp output file
      if (outputPath) cleanTempFile(outputPath);
    }
  },
  {
    connection:  createRedisConnection(),
    concurrency: CONCURRENCY,
  }
);

// ─── Worker event listeners ───────────────────────────────────────────────────

videoWorker.on('completed', (job) => {
  console.log(`[VideoWorker] Job ${job.id} (${job.name}) completed successfully`);
});

videoWorker.on('failed', (job, err) => {
  console.error(`[VideoWorker] Job ${job?.id} (${job?.name}) failed: ${err.message}`);
});

videoWorker.on('error', (err) => {
  console.error('[VideoWorker] Worker error:', err.message);
});

videoWorker.on('stalled', (jobId) => {
  console.warn(`[VideoWorker] Job ${jobId} stalled`);
});

console.log(
  `[VideoWorker] Started. Queue: ${VIDEO_QUEUE_NAME}, concurrency: ${CONCURRENCY}`
);

export default videoWorker;