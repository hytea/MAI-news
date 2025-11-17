import { FastifyInstance, FastifyRequest } from 'fastify';
import { StyleProfileService } from '../services/style-profile.service';
import { authenticateUser } from '../middleware/auth.middleware';
import {
  CreateStyleProfileSchema,
  UpdateStyleProfileSchema,
  ValidationError,
} from '@news-curator/shared';
import { z } from 'zod';

// Request schemas
const StyleProfileIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const GetPublicProfilesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
});

export async function styleProfilesRoutes(app: FastifyInstance): Promise<void> {
  const styleProfileService = new StyleProfileService(app.db);

  /**
   * GET /style-profiles
   * Get all style profiles for the authenticated user
   */
  app.get(
    '/',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest) => {
      if (!request.user) {
        throw new ValidationError('User not authenticated');
      }

      const profiles = await styleProfileService.getUserStyleProfiles(request.user.userId);

      return {
        success: true,
        data: profiles,
      };
    }
  );

  /**
   * GET /style-profiles/public
   * Get public style profiles (community templates)
   */
  app.get(
    '/public',
    async (request: FastifyRequest<{ Querystring: z.infer<typeof GetPublicProfilesQuerySchema> }>) => {
      try {
        const query = GetPublicProfilesQuerySchema.parse(request.query);
        const profiles = await styleProfileService.getPublicStyleProfiles(query.limit);

        return {
          success: true,
          data: profiles,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid query parameters', { errors: error.errors });
        }
        throw error;
      }
    }
  );

  /**
   * GET /style-profiles/:id
   * Get a specific style profile by ID
   */
  app.get(
    '/:id',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest<{ Params: z.infer<typeof StyleProfileIdParamsSchema> }>) => {
      try {
        const params = StyleProfileIdParamsSchema.parse(request.params);

        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        const profile = await styleProfileService.getStyleProfileById(
          params.id,
          request.user.userId
        );

        return {
          success: true,
          data: profile,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid profile ID', { errors: error.errors });
        }
        throw error;
      }
    }
  );

  /**
   * POST /style-profiles
   * Create a new style profile
   */
  app.post(
    '/',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest<{ Body: unknown }>) => {
      try {
        const data = CreateStyleProfileSchema.parse(request.body);

        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        const profile = await styleProfileService.createStyleProfile(
          request.user.userId,
          data
        );

        return {
          success: true,
          data: profile,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid style profile data', { errors: error.errors });
        }
        throw error;
      }
    }
  );

  /**
   * PUT /style-profiles/:id
   * Update a style profile
   */
  app.put(
    '/:id',
    {
      preHandler: authenticateUser,
    },
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof StyleProfileIdParamsSchema>;
        Body: unknown;
      }>
    ) => {
      try {
        const params = StyleProfileIdParamsSchema.parse(request.params);
        const data = UpdateStyleProfileSchema.parse(request.body);

        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        const profile = await styleProfileService.updateStyleProfile(
          params.id,
          request.user.userId,
          data
        );

        return {
          success: true,
          data: profile,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid request', { errors: error.errors });
        }
        throw error;
      }
    }
  );

  /**
   * DELETE /style-profiles/:id
   * Delete a style profile
   */
  app.delete(
    '/:id',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest<{ Params: z.infer<typeof StyleProfileIdParamsSchema> }>) => {
      try {
        const params = StyleProfileIdParamsSchema.parse(request.params);

        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        await styleProfileService.deleteStyleProfile(params.id, request.user.userId);

        return {
          success: true,
          message: 'Style profile deleted successfully',
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid profile ID', { errors: error.errors });
        }
        throw error;
      }
    }
  );
}
