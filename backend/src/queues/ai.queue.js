// ─────────────────────────────────────────────────────────────────────────────
// src/queues/ai.queue.js
// BullMQ Queue for all AI feature jobs.
// All AI job types (captions, background removal, noise suppression, smart cut)
// share one queue. The worker discriminates by job.name (== AIJobType).
// ─────────────────────────────────────────────────────────────────────────────

import { Queue, QueueEvents } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';

const QUEUE_NAME = 'ai-jobs';

let aiQueue       = null;
let aiQueueEvents = null;

/**
 * Returns the singleton AI Queue instance.
 * @returns {Queue}
 */
export function getAIQueue() {
  if (!aiQueue) {
    aiQueue = new Queue(QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type:  'fixed',
          delay: 15000,
        },
        removeOnComplete: {
          age:   parseInt(process.env.QUEUE_JOB_RETAIN_MS || '86400000', 10) / 1000,
          count: 200,
        },
        removeOnFail: {
          age:   7 * 24 * 60 * 60,
          count: 200,
        },
      },
    });

    aiQueue.on('error', (err) => {
      console.error('[AIQueue] Queue error:', err.message);
    });
  }

  return aiQueue;
}

/**
 * Returns the singleton QueueEvents for the AI queue.
 * @returns {QueueEvents}
 */
export function getAIQueueEvents() {
  if (!aiQueueEvents) {
    aiQueueEvents = new QueueEvents(QUEUE_NAME, {
      connection: createRedisConnection(),
    });

    aiQueueEvents.on('error', (err) => {
      console.error('[AIQueueEvents] Error:', err.message);
    });
  }

  return aiQueueEvents;
}

/**
 * Get counts of AI jobs in each state.
 * @returns {Promise<object>}
 */
export async function getAIQueueCounts() {
  const queue = getAIQueue();
  return queue.getJobCounts('active', 'waiting', 'completed', 'failed', 'delayed', 'paused');
}

export { QUEUE_NAME as AI_QUEUE_NAME };