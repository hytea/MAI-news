import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Pool } from 'pg';
import { env } from './config/env';
import { getDatabasePool } from './config/database';
import { authRoutes } from './routes/auth.routes';
import { articlesRoutes } from './routes/articles.routes';
import { styleProfilesRoutes } from './routes/style-profiles.routes';
import { userRoutes } from './routes/user.routes';
import { sourcesRoutes } from './routes/sources.routes';
import { AppError } from '@news-curator/shared';

// Extend Fastify instance with database pool
declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // Add database pool to app instance
  app.decorate('db', getDatabasePool());

  // Register plugins
  await app.register(cors, {
    origin: env.NODE_ENV === 'production'
      ? ['https://news-curator.com']
      : true,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    } else {
      app.log.error(error);
      reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    }
  });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(articlesRoutes, { prefix: '/api/articles' });
  await app.register(styleProfilesRoutes, { prefix: '/api/style-profiles' });
  await app.register(userRoutes, { prefix: '/api/user' });
  await app.register(sourcesRoutes, { prefix: '/api' });

  return app;
}
