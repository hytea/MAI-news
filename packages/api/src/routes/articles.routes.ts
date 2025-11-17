import { FastifyInstance } from 'fastify';

export async function articlesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    return { message: 'Articles routes - to be implemented' };
  });
}
