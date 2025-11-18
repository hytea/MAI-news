import { FastifyInstance, FastifyRequest } from 'fastify';
import { ArticleService } from '../services/article.service';
import { ArticleRewritingService } from '../services/article-rewriting.service';
import { ArticleCacheService } from '../services/article-cache.service';
import { authenticateUser, optionalAuth } from '../middleware/auth.middleware';
import { ArticleCategory, ValidationError, AIProviderError } from '@news-curator/shared';
import { AIProviderFactory } from '@news-curator/ai-providers';
import { redis } from '../config/redis';
import { env } from '../config/env';
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
  skipCache: z.boolean().optional(),
  includeKeyPoints: z.boolean().optional(),
  includeSummary: z.boolean().optional(),
});

const GetRewrittenArticleParamsSchema = z.object({
  id: z.string().uuid(),
  styleProfileId: z.string().uuid(),
});

const ListRewrittenArticlesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const EnrichContextBodySchema = z.object({
  topic: z.string().optional(),
});

export async function articlesRoutes(app: FastifyInstance): Promise<void> {
  const articleService = new ArticleService(app.db);

  // Initialize comprehensive rewriting service
  const cacheService = new ArticleCacheService(redis);
  const aiProvider = AIProviderFactory.create({
    provider: env.AI_PROVIDER,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL || 'anthropic/claude-3-haiku',
    temperature: 0.7,
    maxTokens: 4000,
  });
  const rewritingService = new ArticleRewritingService(app.db, aiProvider, cacheService);

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

        const rewrittenArticle = await rewritingService.rewriteArticle(
          params.id,
          request.user.userId,
          body.styleProfileId,
          {
            skipCache: body.skipCache,
            includeKeyPoints: body.includeKeyPoints,
            includeSummary: body.includeSummary,
            addSourceCitation: true,
          }
        );

        return {
          success: true,
          data: rewrittenArticle,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid request', { errors: error.errors });
        }
        if (error instanceof AIProviderError) {
          throw error; // Will be handled by global error handler
        }
        throw error;
      }
    }
  );

  /**
   * GET /articles/:id/rewritten/:styleProfileId
   * Get a rewritten article by article ID and style profile ID
   * Requires authentication
   */
  app.get(
    '/:id/rewritten/:styleProfileId',
    {
      preHandler: authenticateUser,
    },
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof GetRewrittenArticleParamsSchema>;
      }>
    ) => {
      try {
        const params = GetRewrittenArticleParamsSchema.parse(request.params);

        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        const rewrittenArticle = await rewritingService.getRewrittenArticle(
          params.id,
          request.user.userId,
          params.styleProfileId
        );

        if (!rewrittenArticle) {
          return {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Rewritten article not found',
            },
          };
        }

        return {
          success: true,
          data: rewrittenArticle,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid parameters', { errors: error.errors });
        }
        throw error;
      }
    }
  );

  /**
   * GET /articles/rewritten/my-articles
   * Get all rewritten articles for the authenticated user
   * Requires authentication
   */
  app.get(
    '/rewritten/my-articles',
    {
      preHandler: authenticateUser,
    },
    async (
      request: FastifyRequest<{
        Querystring: z.infer<typeof ListRewrittenArticlesQuerySchema>;
      }>
    ) => {
      try {
        const query = ListRewrittenArticlesQuerySchema.parse(request.query);

        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        const rewrittenArticles = await rewritingService.getUserRewrittenArticles(
          request.user.userId,
          query.limit,
          query.offset
        );

        return {
          success: true,
          data: {
            rewrittenArticles,
            pagination: {
              limit: query.limit,
              offset: query.offset,
              count: rewrittenArticles.length,
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
   * DELETE /articles/rewritten/:id
   * Delete a rewritten article
   * Requires authentication
   */
  app.delete(
    '/rewritten/:id',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      try {
        if (!request.user) {
          throw new ValidationError('User not authenticated');
        }

        await rewritingService.deleteRewrittenArticle(
          request.params.id,
          request.user.userId
        );

        return {
          success: true,
          message: 'Rewritten article deleted successfully',
        };
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * GET /articles/cache/stats
   * Get cache statistics
   * Requires authentication
   */
  app.get(
    '/cache/stats',
    {
      preHandler: authenticateUser,
    },
    async () => {
      const stats = await cacheService.getCacheStats();

      return {
        success: true,
        data: stats,
      };
    }
  );

  /**
   * DELETE /articles/cache/my-cache
   * Clear the authenticated user's cache
   * Requires authentication
   */
  app.delete(
    '/cache/my-cache',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest) => {
      if (!request.user) {
        throw new ValidationError('User not authenticated');
      }

      await cacheService.invalidateUserCache(request.user.userId);

      return {
        success: true,
        message: 'Cache cleared successfully',
      };
    }
  );

  /**
   * POST /articles/:id/analyze-bias
   * Analyze bias in an article
   * Requires authentication
   */
  app.post(
    '/:id/analyze-bias',
    {
      preHandler: authenticateUser,
    },
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof ArticleIdParamsSchema>;
      }>
    ) => {
      try {
        const params = ArticleIdParamsSchema.parse(request.params);
        const article = await articleService.getArticleById(params.id);

        // Analyze bias using AI provider
        const biasAnalysis = await aiProvider.detectBias(article.content);

        return {
          success: true,
          data: biasAnalysis,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid article ID', { errors: error.errors });
        }
        if (error instanceof AIProviderError) {
          throw error;
        }
        throw error;
      }
    }
  );

  /**
   * POST /articles/:id/enrich-context
   * Enrich an article with additional context
   * Requires authentication
   */
  app.post(
    '/:id/enrich-context',
    {
      preHandler: authenticateUser,
    },
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof ArticleIdParamsSchema>;
        Body: z.infer<typeof EnrichContextBodySchema>;
      }>
    ) => {
      try {
        const params = ArticleIdParamsSchema.parse(request.params);
        const body = EnrichContextBodySchema.parse(request.body);
        const article = await articleService.getArticleById(params.id);

        // Use article title as topic if not provided
        const topic = body.topic || article.title;

        // Enrich with context using AI provider
        const enrichedContent = await aiProvider.enrichWithContext(article.content, topic);

        return {
          success: true,
          data: {
            originalContent: article.content,
            enrichedContent,
            topic,
          },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid request', { errors: error.errors });
        }
        if (error instanceof AIProviderError) {
          throw error;
        }
        throw error;
      }
    }
  );

  /**
   * GET /articles/:id/key-points
   * Extract key points from an article
   * Requires authentication
   */
  app.get(
    '/:id/key-points',
    {
      preHandler: authenticateUser,
    },
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof ArticleIdParamsSchema>;
        Querystring: { count?: number };
      }>
    ) => {
      try {
        const params = ArticleIdParamsSchema.parse(request.params);
        const count = request.query.count || 5;
        const article = await articleService.getArticleById(params.id);

        // Extract key points using AI provider
        const keyPoints = await aiProvider.extractKeyPoints(article.content, count);

        return {
          success: true,
          data: {
            keyPoints,
            count: keyPoints.length,
          },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError('Invalid article ID', { errors: error.errors });
        }
        if (error instanceof AIProviderError) {
          throw error;
        }
        throw error;
      }
    }
  );
}
