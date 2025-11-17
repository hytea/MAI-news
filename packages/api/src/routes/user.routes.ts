import { FastifyInstance } from 'fastify';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    return { message: 'User routes - to be implemented' };
  });
}
