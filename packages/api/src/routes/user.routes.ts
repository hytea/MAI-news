import { FastifyInstance, FastifyRequest } from 'fastify';
import { UserPreferencesService } from '../services/user-preferences.service';
import { ReadingHistoryService } from '../services/reading-history.service';
import { authenticateUser } from '../middleware/auth.middleware';
import {
  UpdateUserPreferencesSchema,
  CreateReadingHistorySchema,
  CreateSavedArticleSchema,
  ValidationError,
} from '@news-curator/shared';
import { z } from 'zod';

// Request schemas
const ReadingHistoryQuerySchema = z.object({
  completed: z.coerce.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

const ArticleIdParamsSchema = z.object({
  articleId: z.string().uuid(),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const userPreferencesService = new UserPreferencesService(app.db);
  const readingHistoryService = new ReadingHistoryService(app.db);

  /**
   * GET /user/preferences
   * Get the authenticated user's preferences
   */
  app.get(
    '/preferences',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest) => {
      if (!request.user) {
        throw new ValidationError('User not authenticated');
      }

      const preferences = await userPreferencesService.getUserPreferences(
        request.user.userId
      );

      return {
        success: true,
        data: preferences,
      };
    }
  );

  /**
   * PUT /user/preferences
   * Update the authenticated user's preferences
   */
  app.put(
    '/preferences',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest<{ Body: unknown }>) => {
      try {
        const data = UpdateUserPreferencesSchema.parse(request.body);

        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        const preferences = await userPreferencesService.updateUserPreferences(
          request.user.userId,
          data
        );

        return {
          success: true,
          data: preferences,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid preferences data', { errors: error.errors });
        }
        throw error;
      }
    }
  );

  /**
   * GET /user/reading-history
   * Get the authenticated user's reading history
   */
  app.get(
    '/reading-history',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest<{ Querystring: z.infer<typeof ReadingHistoryQuerySchema> }>) => {
      try {
        const query = ReadingHistoryQuerySchema.parse(request.query);

        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        const filters = {
          completed: query.completed,
          startDate: query.startDate ? new Date(query.startDate) : undefined,
          endDate: query.endDate ? new Date(query.endDate) : undefined,
        };

        const pagination = {
          limit: query.limit,
          offset: query.offset,
        };

        const result = await readingHistoryService.getUserReadingHistory(
          request.user.userId,
          filters,
          pagination
        );

        return {
          success: true,
          data: {
            history: result.history,
            pagination: {
              total: result.total,
              limit: query.limit,
              offset: query.offset,
              hasMore: query.offset + query.limit < result.total,
            },
          },
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
   * POST /user/reading-history
   * Record a reading activity
   */
  app.post(
    '/reading-history',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest<{ Body: unknown }>) => {
      try {
        const data = CreateReadingHistorySchema.parse(request.body);

        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        const record = await readingHistoryService.recordReading(
          request.user.userId,
          data
        );

        return {
          success: true,
          data: record,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid reading history data', { errors: error.errors });
        }
        throw error;
      }
    }
  );

  /**
   * GET /user/reading-stats
   * Get reading statistics for the authenticated user
   */
  app.get(
    '/reading-stats',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest) => {
      if (!request.user) {
        throw new ValidationError('User not authenticated');
      }

      const stats = await readingHistoryService.getReadingStats(request.user.userId);

      return {
        success: true,
        data: stats,
      };
    }
  );

  /**
   * GET /user/saved-articles
   * Get saved articles for the authenticated user
   */
  app.get(
    '/saved-articles',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest<{ Querystring: z.infer<typeof ReadingHistoryQuerySchema> }>) => {
      try {
        const query = ReadingHistoryQuerySchema.parse(request.query);

        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        const pagination = {
          limit: query.limit,
          offset: query.offset,
        };

        const result = await readingHistoryService.getSavedArticles(
          request.user.userId,
          pagination
        );

        return {
          success: true,
          data: {
            savedArticles: result.savedArticles,
            pagination: {
              total: result.total,
              limit: query.limit,
              offset: query.offset,
              hasMore: query.offset + query.limit < result.total,
            },
          },
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
   * POST /user/saved-articles
   * Save an article
   */
  app.post(
    '/saved-articles',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest<{ Body: unknown }>) => {
      try {
        const data = CreateSavedArticleSchema.parse(request.body);

        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        const savedArticle = await readingHistoryService.saveArticle(
          request.user.userId,
          data
        );

        return {
          success: true,
          data: savedArticle,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid saved article data', { errors: error.errors });
        }
        throw error;
      }
    }
  );

  /**
   * DELETE /user/saved-articles/:articleId
   * Unsave an article
   */
  app.delete(
    '/saved-articles/:articleId',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest<{ Params: z.infer<typeof ArticleIdParamsSchema> }>) => {
      try {
        const params = ArticleIdParamsSchema.parse(request.params);

        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        await readingHistoryService.unsaveArticle(
          request.user.userId,
          params.articleId
        );

        return {
          success: true,
          message: 'Article unsaved successfully',
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid article ID', { errors: error.errors });
        }
        throw error;
      }
    }
  );
}
