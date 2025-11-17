import { buildApp } from './app';
import { createDatabasePool, closeDatabasePool } from './config/database';
import { env } from './config/env';

async function start() {
  try {
    // Initialize database connection
    createDatabasePool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    });

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
        await app.close();
        await closeDatabasePool();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

start();
