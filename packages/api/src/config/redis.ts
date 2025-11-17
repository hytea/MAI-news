import { Redis } from 'ioredis';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { env } from './env';

// Create Redis connection
export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

// Redis connection for BullMQ
export const createRedisConnection = () => {
  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  });
};

// Queue names
export const QUEUE_NAMES = {
  NEWS_INGESTION: 'news-ingestion',
} as const;

// Job types
export interface NewsIngestionJobData {
  sourceId: string;
  jobType: 'rss' | 'scrape';
  url: string;
}

// Create news ingestion queue
export const newsIngestionQueue = new Queue<NewsIngestionJobData>(
  QUEUE_NAMES.NEWS_INGESTION,
  {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
  }
);

// Queue events for monitoring
export const newsIngestionQueueEvents = new QueueEvents(
  QUEUE_NAMES.NEWS_INGESTION,
  {
    connection: createRedisConnection(),
  }
);

// Graceful shutdown
export const closeRedis = async () => {
  await newsIngestionQueue.close();
  await newsIngestionQueueEvents.close();
  await redis.quit();
};

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing Redis connections...');
  await closeRedis();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing Redis connections...');
  await closeRedis();
  process.exit(0);
});
