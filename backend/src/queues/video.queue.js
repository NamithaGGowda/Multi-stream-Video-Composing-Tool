// ─────────────────────────────────────────────────────────────────────────────
// src/queues/video.queue.js
// BullMQ Queue definition for individual video processing jobs.
// (trim, merge, filter, speed, text overlay, audio mix, transition, reverse)
// Each queue gets its own dedicated ioredis connection as required by BullMQ.
// ─────────────────────────────────────────────────────────────────────────────

import { Queue, QueueEvents } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';

const QUEUE_NAME = 'video-processing';

let videoQueue = null;
let videoQueueEvents = null;

/**
 * Returns the singleton Video processing Queue instance.
 * Creates it on first call.
 *
 * @returns {Queue}
 */
export function getVideoQueue() {
  if (!videoQueue) {
    videoQueue = new Queue(QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts:    3,
        backoff: {
          type:  'exponential',
          delay: 3000,
        },
        removeOnComplete: {
          age:   parseInt(process.env.QUEUE_JOB_RETAIN_MS || '86400000', 10) / 1000,
          count: 100,
        },
        removeOnFail: {
          age:   7 * 24 * 60 * 60, // 7 days
          count: 200,
        },
      },
    });

    videoQueue.on('error', (err) => {
      console.error('[VideoQueue] Queue error:', err.message);
    });
  }

  return videoQueue;
}

/**
 * Returns the singleton QueueEvents instance for the video queue.
 * QueueEvents lets you listen to job lifecycle events (completed, failed, etc.)
 * from outside the worker process.
 *
 * @returns {QueueEvents}
 */
export function getVideoQueueEvents() {
  if (!videoQueueEvents) {
    videoQueueEvents = new QueueEvents(QUEUE_NAME, {
      connection: createRedisConnection(),
    });

    videoQueueEvents.on('error', (err) => {
      console.error('[VideoQueueEvents] Error:', err.message);
    });
  }

  return videoQueueEvents;
}

/**
 * Add a video processing job to the queue.
 *
 * @param {string} jobType  - One of: trim | merge | filter | speed | text | audio | transition | reverse
 * @param {object} data     - Job payload (varies by type — see worker for schema)
 * @param {object} [opts]   - BullMQ job options override
 * @returns {Promise<Job>}
 */
export async function addVideoJob(jobType, data, opts = {}) {
  const queue = getVideoQueue();
  return queue.add(jobType, data, opts);
}

/**
 * Get a job by its BullMQ ID.
 *
 * @param {string} bullJobId
 * @returns {Promise<Job|null>}
 */
export async function getVideoJobById(bullJobId) {
  const queue = getVideoQueue();
  return queue.getJob(bullJobId);
}

/**
 * Get counts of jobs in each state.
 * Useful for monitoring dashboards.
 *
 * @returns {Promise<object>}
 */
export async function getVideoQueueCounts() {
  const queue = getVideoQueue();
  return queue.getJobCounts('active', 'waiting', 'completed', 'failed', 'delayed', 'paused');
}

export { QUEUE_NAME as VIDEO_QUEUE_NAME };