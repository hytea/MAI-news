import { buildApp } from './app';
import { createDatabasePool, closeDatabasePool, getDatabasePool } from './config/database';
import { closeRedis } from './config/redis';
import { env } from './config/env';
import { IngestionWorker } from './workers/ingestion.worker';
import { SchedulerService } from './services/scheduler.service';

async function start() {
  let worker: IngestionWorker | null = null;
  let scheduler: SchedulerService | null = null;

  try {
    // Initialize database connection
    createDatabasePool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    });

    const db = getDatabasePool();

    // Start ingestion worker
    worker = new IngestionWorker(db);
    console.log('✅ News ingestion worker started');

    // Start scheduler for periodic ingestion (runs every 15 minutes)
    scheduler = new SchedulerService(db, 15);
    scheduler.start();
    console.log('✅ News ingestion scheduler started');

    // Build and start Fastify app
    const app = await buildApp();

    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    console.log(`🚀 Server running on http://${env.HOST}:${env.PORT}`);

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n${signal} received, shutting down gracefully...`);

        // Stop scheduler
        if (scheduler) {
          scheduler.stop();
        }

        // Close worker
        if (worker) {
          await worker.close();
        }

        // Close app
        await app.close();

        // Close Redis connections
        await closeRedis();

        // Close database pool
        await closeDatabasePool();

        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Error starting server:', error);

    // Cleanup on error
    if (worker) {
      await worker.close();
    }
    if (scheduler) {
      scheduler.stop();
    }
    await closeRedis();
    await closeDatabasePool();

    process.exit(1);
  }
}

start();
