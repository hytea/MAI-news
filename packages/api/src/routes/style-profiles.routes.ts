import { FastifyInstance } from 'fastify';

export async function styleProfilesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    return { message: 'Style profiles routes - to be implemented' };
  });
}
