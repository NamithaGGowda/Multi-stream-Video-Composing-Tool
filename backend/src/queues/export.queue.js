// ─────────────────────────────────────────────────────────────────────────────
// src/queues/export.queue.js
// BullMQ Queue for full-timeline export jobs.
// Only one export job runs per worker concurrently (CPU/memory intensive).
// ─────────────────────────────────────────────────────────────────────────────

import { Queue, QueueEvents } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';

const QUEUE_NAME = 'export';

let exportQueue       = null;
let exportQueueEvents = null;

/**
 * Returns the singleton Export Queue instance.
 * @returns {Queue}
 */
export function getExportQueue() {
  if (!exportQueue) {
    exportQueue = new Queue(QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type:  'fixed',
          delay: 10000,
        },
        removeOnComplete: {
          age:   parseInt(process.env.QUEUE_JOB_RETAIN_MS || '86400000', 10) / 1000,
          count: 50,
        },
        removeOnFail: {
          age:   14 * 24 * 60 * 60, // 14 days — keep failed exports longer for debugging
          count: 100,
        },
      },
    });

    exportQueue.on('error', (err) => {
      console.error('[ExportQueue] Queue error:', err.message);
    });
  }

  return exportQueue;
}

/**
 * Returns the singleton QueueEvents for the export queue.
 * @returns {QueueEvents}
 */
export function getExportQueueEvents() {
  if (!exportQueueEvents) {
    exportQueueEvents = new QueueEvents(QUEUE_NAME, {
      connection: createRedisConnection(),
    });

    exportQueueEvents.on('error', (err) => {
      console.error('[ExportQueueEvents] Error:', err.message);
    });
  }

  return exportQueueEvents;
}

/**
 * Get counts of export jobs in each state.
 * @returns {Promise<object>}
 */
export async function getExportQueueCounts() {
  const queue = getExportQueue();
  return queue.getJobCounts('active', 'waiting', 'completed', 'failed', 'delayed', 'paused');
}

export { QUEUE_NAME as EXPORT_QUEUE_NAME };