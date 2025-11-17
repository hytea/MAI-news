import { Pool } from 'pg';
import {
  Article,
  ArticleWithSource,
  RewrittenArticle,
  StyleProfile,
  ArticleCategory,
  NotFoundError,
  ValidationError,
} from '@news-curator/shared';
import { createAIProvider } from '@news-curator/ai-providers';
import { env } from '../config/env';

export interface ArticleFilters {
  category?: ArticleCategory;
  sourceId?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ArticlePagination {
  limit: number;
  offset: number;
  sortBy?: 'published_at' | 'importance_score' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

export class ArticleService {
  constructor(private db: Pool) {}

  /**
   * List articles with filters and pagination
   */
  async listArticles(
    filters: ArticleFilters,
    pagination: ArticlePagination,
    userId?: string
  ): Promise<{ articles: ArticleWithSource[]; total: number }> {
    const {
      category,
      sourceId,
      search,
      startDate,
      endDate,
    } = filters;

    const {
      limit = 10,
      offset = 0,
      sortBy = 'published_at',
      sortOrder = 'desc',
    } = pagination;

    // Build WHERE clauses
    const whereClauses: string[] = [];
    const queryParams: any[] = [];
    let paramCounter = 1;

    if (category) {
      whereClauses.push(`a.category = $${paramCounter}`);
      queryParams.push(category);
      paramCounter++;
    }

    if (sourceId) {
      whereClauses.push(`a.source_id = $${paramCounter}`);
      queryParams.push(sourceId);
      paramCounter++;
    }

    if (search) {
      whereClauses.push(`(a.title ILIKE $${paramCounter} OR a.original_content ILIKE $${paramCounter})`);
      queryParams.push(`%${search}%`);
      paramCounter++;
    }

    if (startDate) {
      whereClauses.push(`a.published_at >= $${paramCounter}`);
      queryParams.push(startDate);
      paramCounter++;
    }

    if (endDate) {
      whereClauses.push(`a.published_at <= $${paramCounter}`);
      queryParams.push(endDate);
      paramCounter++;
    }

    // Apply user preferences if provided
    if (userId) {
      const prefsResult = await this.db.query(
        'SELECT muted_categories, muted_sources FROM user_preferences WHERE user_id = $1',
        [userId]
      );

      if (prefsResult.rows.length > 0) {
        const { muted_categories, muted_sources } = prefsResult.rows[0];

        if (muted_categories && muted_categories.length > 0) {
          whereClauses.push(`a.category != ALL($${paramCounter})`);
          queryParams.push(muted_categories);
          paramCounter++;
        }

        if (muted_sources && muted_sources.length > 0) {
          whereClauses.push(`a.source_id != ALL($${paramCounter})`);
          queryParams.push(muted_sources);
          paramCounter++;
        }
      }
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    // Build the main query
    const query = `
      SELECT
        a.id,
        a.source_id,
        a.title,
        a.original_content,
        a.url,
        a.author,
        a.published_at,
        a.category,
        a.image_url,
        a.importance_score,
        a.created_at,
        a.updated_at,
        s.id as source_id,
        s.name as source_name,
        s.url as source_url,
        s.reliability_score,
        s.favicon as source_favicon,
        s.is_active as source_is_active,
        s.created_at as source_created_at,
        s.updated_at as source_updated_at
      FROM articles a
      INNER JOIN sources s ON a.source_id = s.id
      ${whereClause}
      ORDER BY a.${sortBy} ${sortOrder.toUpperCase()}
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `;

    queryParams.push(limit, offset);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM articles a
      ${whereClause}
    `;

    const [articlesResult, countResult] = await Promise.all([
      this.db.query(query, queryParams),
      this.db.query(countQuery, queryParams.slice(0, -2)), // Exclude limit and offset
    ]);

    const articles: ArticleWithSource[] = articlesResult.rows.map(row => ({
      id: row.id,
      sourceId: row.source_id,
      title: row.title,
      originalContent: row.original_content,
      url: row.url,
      author: row.author,
      publishedAt: new Date(row.published_at),
      category: row.category,
      imageUrl: row.image_url,
      importanceScore: row.importance_score,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      source: {
        id: row.source_id,
        name: row.source_name,
        url: row.source_url,
        reliabilityScore: row.reliability_score,
        favicon: row.source_favicon,
        isActive: row.source_is_active,
        createdAt: new Date(row.source_created_at),
        updatedAt: new Date(row.source_updated_at),
      },
    }));

    return {
      articles,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  /**
   * Get a single article by ID
   */
  async getArticleById(articleId: string): Promise<ArticleWithSource> {
    const query = `
      SELECT
        a.id,
        a.source_id,
        a.title,
        a.original_content,
        a.url,
        a.author,
        a.published_at,
        a.category,
        a.image_url,
        a.importance_score,
        a.created_at,
        a.updated_at,
        s.id as source_id,
        s.name as source_name,
        s.url as source_url,
        s.reliability_score,
        s.favicon as source_favicon,
        s.is_active as source_is_active,
        s.created_at as source_created_at,
        s.updated_at as source_updated_at
      FROM articles a
      INNER JOIN sources s ON a.source_id = s.id
      WHERE a.id = $1
    `;

    const result = await this.db.query(query, [articleId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Article not found');
    }

    const row = result.rows[0];

    return {
      id: row.id,
      sourceId: row.source_id,
      title: row.title,
      originalContent: row.original_content,
      url: row.url,
      author: row.author,
      publishedAt: new Date(row.published_at),
      category: row.category,
      imageUrl: row.image_url,
      importanceScore: row.importance_score,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      source: {
        id: row.source_id,
        name: row.source_name,
        url: row.source_url,
        reliabilityScore: row.reliability_score,
        favicon: row.source_favicon,
        isActive: row.source_is_active,
        createdAt: new Date(row.source_created_at),
        updatedAt: new Date(row.source_updated_at),
      },
    };
  }

  /**
   * Rewrite an article using AI based on a style profile
   */
  async rewriteArticle(
    articleId: string,
    userId: string,
    styleProfileId: string
  ): Promise<RewrittenArticle> {
    // Check if already rewritten with this style
    const existingQuery = `
      SELECT * FROM rewritten_articles
      WHERE article_id = $1 AND user_id = $2 AND style_profile_id = $3
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const existingResult = await this.db.query(existingQuery, [
      articleId,
      userId,
      styleProfileId,
    ]);

    // If rewritten recently (within 24 hours), return cached version
    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      const createdAt = new Date(existing.created_at);
      const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceCreation < 24) {
        return {
          id: existing.id,
          articleId: existing.article_id,
          userId: existing.user_id,
          styleProfileId: existing.style_profile_id,
          rewrittenContent: existing.rewritten_content,
          summary: existing.summary,
          keyPoints: existing.key_points,
          processingTimeMs: existing.processing_time_ms,
          aiCost: existing.ai_cost,
          createdAt: new Date(existing.created_at),
        };
      }
    }

    // Fetch the article
    const article = await this.getArticleById(articleId);

    // Fetch the style profile
    const styleQuery = `
      SELECT * FROM style_profiles
      WHERE id = $1 AND user_id = $2
    `;

    const styleResult = await this.db.query(styleQuery, [styleProfileId, userId]);

    if (styleResult.rows.length === 0) {
      throw new NotFoundError('Style profile not found');
    }

    const styleRow = styleResult.rows[0];
    const styleProfile: StyleProfile = {
      id: styleRow.id,
      userId: styleRow.user_id,
      name: styleRow.name,
      description: styleRow.description,
      predefinedStyle: styleRow.predefined_style,
      customPrompt: styleRow.custom_prompt,
      tone: styleRow.tone,
      length: styleRow.length,
      technicalLevel: styleRow.technical_level,
      includeContext: styleRow.include_context,
      includeKeyPoints: styleRow.include_key_points,
      isDefault: styleRow.is_default,
      isPublic: styleRow.is_public,
      usageCount: styleRow.usage_count,
      createdAt: new Date(styleRow.created_at),
      updatedAt: new Date(styleRow.updated_at),
    };

    // Create AI provider
    const aiProvider = createAIProvider({
      provider: env.AI_PROVIDER,
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL,
      temperature: 0.7,
      maxTokens: 4000,
      timeoutMs: 30000,
    });

    // Rewrite the article
    const rewriteResult = await aiProvider.rewriteArticle(
      article.originalContent,
      styleProfile
    );

    // Generate summary and key points if requested
    let summary: string | undefined;
    let keyPoints: string[] | undefined;

    if (styleProfile.includeKeyPoints) {
      keyPoints = await aiProvider.extractKeyPoints(article.originalContent, 5);
    }

    // Save the rewritten article
    const insertQuery = `
      INSERT INTO rewritten_articles (
        article_id,
        user_id,
        style_profile_id,
        rewritten_content,
        summary,
        key_points,
        processing_time_ms,
        ai_cost
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const insertResult = await this.db.query(insertQuery, [
      articleId,
      userId,
      styleProfileId,
      rewriteResult.content,
      summary,
      keyPoints,
      rewriteResult.processingTimeMs,
      rewriteResult.cost,
    ]);

    // Update style profile usage count
    await this.db.query(
      'UPDATE style_profiles SET usage_count = usage_count + 1 WHERE id = $1',
      [styleProfileId]
    );

    const row = insertResult.rows[0];

    return {
      id: row.id,
      articleId: row.article_id,
      userId: row.user_id,
      styleProfileId: row.style_profile_id,
      rewrittenContent: row.rewritten_content,
      summary: row.summary,
      keyPoints: row.key_points,
      processingTimeMs: row.processing_time_ms,
      aiCost: row.ai_cost,
      createdAt: new Date(row.created_at),
    };
  }
}
