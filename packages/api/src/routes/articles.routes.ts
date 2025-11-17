import { FastifyInstance, FastifyRequest } from 'fastify';
import { ArticleService } from '../services/article.service';
import { authenticateUser, optionalAuth } from '../middleware/auth.middleware';
import { ArticleCategory, ValidationError } from '@news-curator/shared';
import { z } from 'zod';

// Request schemas
const ListArticlesQuerySchema = z.object({
  category: z.nativeEnum(ArticleCategory).optional(),
  sourceId: z.string().uuid().optional(),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(['published_at', 'importance_score', 'created_at']).default('published_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const ArticleIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const RewriteArticleBodySchema = z.object({
  styleProfileId: z.string().uuid(),
});

export async function articlesRoutes(app: FastifyInstance): Promise<void> {
  const articleService = new ArticleService(app.db);

  /**
   * GET /articles
   * List articles with optional filters and pagination
   * Optional auth - if authenticated, user preferences will be applied
   */
  app.get(
    '/',
    {
      preHandler: optionalAuth,
    },
    async (request: FastifyRequest<{ Querystring: z.infer<typeof ListArticlesQuerySchema> }>) => {
      try {
        const query = ListArticlesQuerySchema.parse(request.query);

        const filters = {
          category: query.category,
          sourceId: query.sourceId,
          search: query.search,
          startDate: query.startDate ? new Date(query.startDate) : undefined,
          endDate: query.endDate ? new Date(query.endDate) : undefined,
        };

        const pagination = {
          limit: query.limit,
          offset: query.offset,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        };

        const userId = request.user?.userId;
        const result = await articleService.listArticles(filters, pagination, userId);

        return {
          success: true,
          data: {
            articles: result.articles,
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
   * GET /articles/:id
   * Get a single article by ID
   */
  app.get(
    '/:id',
    async (request: FastifyRequest<{ Params: z.infer<typeof ArticleIdParamsSchema> }>) => {
      try {
        const params = ArticleIdParamsSchema.parse(request.params);
        const article = await articleService.getArticleById(params.id);

        return {
          success: true,
          data: article,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid article ID', { errors: error.errors });
        }
        throw error;
      }
    }
  );

  /**
   * POST /articles/:id/rewrite
   * Rewrite an article using a specific style profile
   * Requires authentication
   */
  app.post(
    '/:id/rewrite',
    {
      preHandler: authenticateUser,
    },
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof ArticleIdParamsSchema>;
        Body: z.infer<typeof RewriteArticleBodySchema>;
      }>
    ) => {
      try {
        const params = ArticleIdParamsSchema.parse(request.params);
        const body = RewriteArticleBodySchema.parse(request.body);

        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        const rewrittenArticle = await articleService.rewriteArticle(
          params.id,
          request.user.userId,
          body.styleProfileId
        );

        return {
          success: true,
          data: rewrittenArticle,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid request', { errors: error.errors });
        }
        throw error;
      }
    }
  );
}
