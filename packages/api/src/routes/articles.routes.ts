import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { getDatabasePool } from '../config/database';
import { redis } from '../config/redis';
import { authenticateUser } from '../middleware/auth.middleware';
import { ArticleRewritingService } from '../services/article-rewriting.service';
import { ArticleCacheService } from '../services/article-cache.service';
import { AIProviderFactory } from '@news-curator/ai-providers';
import { env } from '../config/env';
import { ValidationError, AIProviderError } from '@news-curator/shared';

let rewritingService: ArticleRewritingService;

export async function articlesRoutes(app: FastifyInstance): Promise<void> {
  const db: Pool = getDatabasePool();
  const cacheService = new ArticleCacheService(redis);

  // Initialize AI provider and rewriting service
  const aiProvider = AIProviderFactory.create({
    provider: env.AI_PROVIDER,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL || 'anthropic/claude-3-haiku',
    temperature: 0.7,
    maxTokens: 4000,
  });

  rewritingService = new ArticleRewritingService(db, aiProvider, cacheService);

  // Get all articles (paginated)
  app.get('/', async (request: FastifyRequest<{
    Querystring: {
      limit?: string;
      offset?: string;
      category?: string;
    };
  }>, reply: FastifyReply) => {
    const limit = parseInt(request.query.limit || '50', 10);
    const offset = parseInt(request.query.offset || '0', 10);
    const category = request.query.category;

    let query = `
      SELECT
        a.*,
        s.id as source_id,
        s.name as source_name,
        s.url as source_url,
        s.reliability_score,
        s.favicon
      FROM articles a
      JOIN sources s ON a.source_id = s.id
    `;

    const params: any[] = [];

    if (category) {
      query += ` WHERE a.category = $1`;
      params.push(category);
      query += ` ORDER BY a.published_at DESC LIMIT $2 OFFSET $3`;
      params.push(limit, offset);
    } else {
      query += ` ORDER BY a.published_at DESC LIMIT $1 OFFSET $2`;
      params.push(limit, offset);
    }

    const result = await db.query(query, params);

    const articles = result.rows.map(row => ({
      id: row.id,
      sourceId: row.source_id,
      title: row.title,
      originalContent: row.original_content,
      url: row.url,
      author: row.author,
      publishedAt: row.published_at,
      category: row.category,
      imageUrl: row.image_url,
      importanceScore: row.importance_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      source: {
        id: row.source_id,
        name: row.source_name,
        url: row.source_url,
        reliabilityScore: row.reliability_score,
        favicon: row.favicon,
      },
    }));

    reply.send({ articles, count: articles.length, limit, offset });
  });

  // Get article by ID
  app.get('/:id', async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const { id } = request.params;

    const query = `
      SELECT
        a.*,
        s.id as source_id,
        s.name as source_name,
        s.url as source_url,
        s.reliability_score,
        s.favicon,
        s.is_active
      FROM articles a
      JOIN sources s ON a.source_id = s.id
      WHERE a.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      reply.status(404).send({ error: 'Article not found' });
      return;
    }

    const row = result.rows[0];

    const article = {
      id: row.id,
      sourceId: row.source_id,
      title: row.title,
      originalContent: row.original_content,
      url: row.url,
      author: row.author,
      publishedAt: row.published_at,
      category: row.category,
      imageUrl: row.image_url,
      importanceScore: row.importance_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      source: {
        id: row.source_id,
        name: row.source_name,
        url: row.source_url,
        reliabilityScore: row.reliability_score,
        favicon: row.favicon,
        isActive: row.is_active,
      },
    };

    reply.send({ article });
  });

  // Rewrite article with style profile
  app.post('/:id/rewrite', {
    preHandler: authenticateUser,
  }, async (request: FastifyRequest<{
    Params: { id: string };
    Body: {
      styleProfileId: string;
      skipCache?: boolean;
      includeKeyPoints?: boolean;
      includeSummary?: boolean;
    };
  }>, reply: FastifyReply) => {
    if (!request.user) {
      throw new Error('User not authenticated');
    }

    const { id: articleId } = request.params;
    const { styleProfileId, skipCache, includeKeyPoints, includeSummary } = request.body;

    if (!styleProfileId) {
      throw new ValidationError('styleProfileId is required');
    }

    try {
      const rewrittenArticle = await rewritingService.rewriteArticle(
        articleId,
        request.user.userId,
        styleProfileId,
        {
          skipCache,
          includeKeyPoints,
          includeSummary,
          addSourceCitation: true,
        }
      );

      reply.send({ rewrittenArticle });
    } catch (error) {
      if (error instanceof AIProviderError) {
        reply.status(503).send({
          error: {
            code: 'AI_PROVIDER_ERROR',
            message: error.message,
          },
        });
      } else {
        throw error;
      }
    }
  });

  // Get rewritten article
  app.get('/:id/rewritten/:styleProfileId', {
    preHandler: authenticateUser,
  }, async (request: FastifyRequest<{
    Params: { id: string; styleProfileId: string };
  }>, reply: FastifyReply) => {
    if (!request.user) {
      throw new Error('User not authenticated');
    }

    const { id: articleId, styleProfileId } = request.params;

    const rewrittenArticle = await rewritingService.getRewrittenArticle(
      articleId,
      request.user.userId,
      styleProfileId
    );

    if (!rewrittenArticle) {
      reply.status(404).send({ error: 'Rewritten article not found' });
      return;
    }

    reply.send({ rewrittenArticle });
  });

  // Get all rewritten articles for user
  app.get('/rewritten/my-articles', {
    preHandler: authenticateUser,
  }, async (request: FastifyRequest<{
    Querystring: {
      limit?: string;
      offset?: string;
    };
  }>, reply: FastifyReply) => {
    if (!request.user) {
      throw new Error('User not authenticated');
    }

    const limit = parseInt(request.query.limit || '50', 10);
    const offset = parseInt(request.query.offset || '0', 10);

    const rewrittenArticles = await rewritingService.getUserRewrittenArticles(
      request.user.userId,
      limit,
      offset
    );

    reply.send({ rewrittenArticles, count: rewrittenArticles.length, limit, offset });
  });

  // Delete rewritten article
  app.delete('/rewritten/:id', {
    preHandler: authenticateUser,
  }, async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    if (!request.user) {
      throw new Error('User not authenticated');
    }

    const { id } = request.params;

    await rewritingService.deleteRewrittenArticle(id, request.user.userId);

    reply.send({ message: 'Rewritten article deleted successfully' });
  });

  // Cache management endpoints (admin only - you may want to add admin middleware)

  // Get cache stats
  app.get('/cache/stats', {
    preHandler: authenticateUser,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await cacheService.getCacheStats();
    reply.send({ stats });
  });

  // Clear user's cache
  app.delete('/cache/my-cache', {
    preHandler: authenticateUser,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new Error('User not authenticated');
    }

    await cacheService.invalidateUserCache(request.user.userId);
    reply.send({ message: 'Cache cleared successfully' });
  });
}
