import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  AIProvider,
  RewrittenArticle,
  RewrittenArticleWithDetails,
  StyleProfile,
  Article,
  ArticleWithSource,
  Citation,
  DatabaseError,
  AIProviderError,
} from '@news-curator/shared';
import { CitationExtractionService } from './citation-extraction.service';
import { ArticleCacheService } from './article-cache.service';

export interface RewriteOptions {
  skipCache?: boolean;
  includeKeyPoints?: boolean;
  includeSummary?: boolean;
  addSourceCitation?: boolean;
}

/**
 * Service for rewriting articles using AI providers
 */
export class ArticleRewritingService {
  private citationService: CitationExtractionService;
  private cacheService: ArticleCacheService;

  constructor(
    private db: Pool,
    private aiProvider: AIProvider,
    cacheService: ArticleCacheService
  ) {
    this.citationService = new CitationExtractionService(db);
    this.cacheService = cacheService;
  }

  /**
   * Rewrite an article with a specific style profile
   */
  async rewriteArticle(
    articleId: string,
    userId: string,
    styleProfileId: string,
    options: RewriteOptions = {}
  ): Promise<RewrittenArticleWithDetails> {
    const {
      skipCache = false,
      includeKeyPoints = true,
      includeSummary = true,
      addSourceCitation = true,
    } = options;

    // Check cache first (unless skipped)
    if (!skipCache) {
      const cached = await this.cacheService.getCachedArticleWithDetails(
        articleId,
        userId,
        styleProfileId
      );

      if (cached) {
        console.log(`Cache hit for article ${articleId}`);
        return cached;
      }
    }

    console.log(`Cache miss for article ${articleId}, processing rewrite...`);

    // Get article, style profile, and check if already rewritten
    const [article, styleProfile, existingRewrite] = await Promise.all([
      this.getArticleWithSource(articleId),
      this.getStyleProfile(styleProfileId, userId),
      this.getExistingRewrite(articleId, userId, styleProfileId),
    ]);

    if (!article) {
      throw new DatabaseError(`Article with id ${articleId} not found`);
    }

    if (!styleProfile) {
      throw new DatabaseError(`Style profile with id ${styleProfileId} not found`);
    }

    // If exists and not skipping cache, return from database
    if (existingRewrite && !skipCache) {
      const citations = await this.citationService.getCitationsForArticle(existingRewrite.id);

      const result: RewrittenArticleWithDetails = {
        ...existingRewrite,
        article,
        citations,
      };

      // Cache it for next time
      await this.cacheService.cacheRewrittenArticleWithDetails(result);

      return result;
    }

    // Perform AI rewriting
    const startTime = Date.now();

    try {
      const aiResult = await this.aiProvider.rewriteArticle(
        article.originalContent,
        styleProfile
      );

      const processingTimeMs = Date.now() - startTime;

      // Generate summary if requested
      let summary: string | undefined;
      if (includeSummary || styleProfile.includeKeyPoints) {
        summary = aiResult.summary || await this.aiProvider.generateSummary(
          aiResult.content,
          200
        );
      }

      // Extract key points if requested
      let keyPoints: string[] | undefined;
      if (includeKeyPoints || styleProfile.includeKeyPoints) {
        keyPoints = aiResult.keyPoints || await this.aiProvider.extractKeyPoints(
          aiResult.content,
          5
        );
      }

      // Extract citations from rewritten content
      const extractedCitations = this.citationService.extractCitationsFromAIResponse(
        aiResult.content,
        aiResult.citations
      );

      // Store or update rewritten article
      const rewrittenArticle = existingRewrite
        ? await this.updateRewrittenArticle(existingRewrite.id, {
            rewrittenContent: aiResult.content,
            summary,
            keyPoints,
            processingTimeMs,
            aiCost: aiResult.cost,
          })
        : await this.storeRewrittenArticle({
            articleId,
            userId,
            styleProfileId,
            rewrittenContent: aiResult.content,
            summary,
            keyPoints,
            processingTimeMs,
            aiCost: aiResult.cost,
          });

      // Delete old citations if updating
      if (existingRewrite) {
        await this.citationService.deleteCitationsForArticle(rewrittenArticle.id);
      }

      // Store citations
      const citations = await this.citationService.storeCitations(
        rewrittenArticle.id,
        extractedCitations,
        articleId
      );

      // Add source article citation if requested
      if (addSourceCitation) {
        const sourceCitation = await this.citationService.addSourceArticleCitation(
          rewrittenArticle.id,
          articleId,
          article.url,
          article.source.name
        );
        citations.unshift(sourceCitation);
      }

      // Increment style profile usage count
      await this.incrementStyleUsage(styleProfileId);

      const result: RewrittenArticleWithDetails = {
        ...rewrittenArticle,
        article,
        citations,
      };

      // Cache the result
      await this.cacheService.cacheRewrittenArticleWithDetails(result);

      return result;
    } catch (error) {
      console.error('Failed to rewrite article:', error);

      if (error instanceof AIProviderError) {
        throw error;
      }

      throw new AIProviderError(
        `Failed to rewrite article: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a rewritten article (from cache, database, or create new)
   */
  async getRewrittenArticle(
    articleId: string,
    userId: string,
    styleProfileId: string
  ): Promise<RewrittenArticleWithDetails | null> {
    // Check cache first
    const cached = await this.cacheService.getCachedArticleWithDetails(
      articleId,
      userId,
      styleProfileId
    );

    if (cached) {
      return cached;
    }

    // Check database
    const existing = await this.getExistingRewrite(articleId, userId, styleProfileId);

    if (!existing) {
      return null;
    }

    const [article, citations] = await Promise.all([
      this.getArticleWithSource(articleId),
      this.citationService.getCitationsForArticle(existing.id),
    ]);

    if (!article) {
      return null;
    }

    const result: RewrittenArticleWithDetails = {
      ...existing,
      article,
      citations,
    };

    // Cache for next time
    await this.cacheService.cacheRewrittenArticleWithDetails(result);

    return result;
  }

  /**
   * Get all rewritten articles for a user
   */
  async getUserRewrittenArticles(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<RewrittenArticleWithDetails[]> {
    const query = `
      SELECT
        ra.*,
        a.*,
        s.*
      FROM rewritten_articles ra
      JOIN articles a ON ra.article_id = a.id
      JOIN sources s ON a.source_id = s.id
      WHERE ra.user_id = $1
      ORDER BY ra.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query(query, [userId, limit, offset]);

    const rewrittenArticles = await Promise.all(
      result.rows.map(async (row) => {
        const citations = await this.citationService.getCitationsForArticle(row.id);

        return this.mapRowToRewrittenArticleWithDetails(row, citations);
      })
    );

    return rewrittenArticles;
  }

  /**
   * Delete a rewritten article
   */
  async deleteRewrittenArticle(id: string, userId: string): Promise<void> {
    const query = `
      DELETE FROM rewritten_articles
      WHERE id = $1 AND user_id = $2
      RETURNING article_id, user_id, style_profile_id
    `;

    const result = await this.db.query(query, [id, userId]);

    if (result.rows.length > 0) {
      const { article_id, user_id, style_profile_id } = result.rows[0];
      await this.cacheService.invalidateCache(article_id, user_id, style_profile_id);
    }
  }

  // Private helper methods

  private async getArticleWithSource(articleId: string): Promise<ArticleWithSource | null> {
    const query = `
      SELECT
        a.*,
        s.id as source_id,
        s.name as source_name,
        s.url as source_url,
        s.reliability_score,
        s.favicon,
        s.is_active,
        s.created_at as source_created_at,
        s.updated_at as source_updated_at
      FROM articles a
      JOIN sources s ON a.source_id = s.id
      WHERE a.id = $1
    `;

    const result = await this.db.query(query, [articleId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
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
        createdAt: row.source_created_at,
        updatedAt: row.source_updated_at,
      },
    };
  }

  private async getStyleProfile(styleProfileId: string, userId: string): Promise<StyleProfile | null> {
    const query = `
      SELECT * FROM style_profiles
      WHERE id = $1 AND (user_id = $2 OR is_public = TRUE)
    `;

    const result = await this.db.query(query, [styleProfileId, userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      predefinedStyle: row.predefined_style,
      customPrompt: row.custom_prompt,
      tone: row.tone,
      length: row.length,
      technicalLevel: row.technical_level,
      includeContext: row.include_context,
      includeKeyPoints: row.include_key_points,
      isDefault: row.is_default,
      isPublic: row.is_public,
      usageCount: row.usage_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async getExistingRewrite(
    articleId: string,
    userId: string,
    styleProfileId: string
  ): Promise<RewrittenArticle | null> {
    const query = `
      SELECT * FROM rewritten_articles
      WHERE article_id = $1 AND user_id = $2 AND style_profile_id = $3
    `;

    const result = await this.db.query(query, [articleId, userId, styleProfileId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToRewrittenArticle(result.rows[0]);
  }

  private async storeRewrittenArticle(data: {
    articleId: string;
    userId: string;
    styleProfileId: string;
    rewrittenContent: string;
    summary?: string;
    keyPoints?: string[];
    processingTimeMs?: number;
    aiCost?: number;
  }): Promise<RewrittenArticle> {
    const id = uuidv4();
    const query = `
      INSERT INTO rewritten_articles (
        id,
        article_id,
        user_id,
        style_profile_id,
        rewritten_content,
        summary,
        key_points,
        processing_time_ms,
        ai_cost,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      id,
      data.articleId,
      data.userId,
      data.styleProfileId,
      data.rewrittenContent,
      data.summary || null,
      JSON.stringify(data.keyPoints || []),
      data.processingTimeMs || null,
      data.aiCost || null,
      new Date(),
    ]);

    return this.mapRowToRewrittenArticle(result.rows[0]);
  }

  private async updateRewrittenArticle(
    id: string,
    data: {
      rewrittenContent: string;
      summary?: string;
      keyPoints?: string[];
      processingTimeMs?: number;
      aiCost?: number;
    }
  ): Promise<RewrittenArticle> {
    const query = `
      UPDATE rewritten_articles
      SET
        rewritten_content = $2,
        summary = $3,
        key_points = $4,
        processing_time_ms = $5,
        ai_cost = $6
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [
      id,
      data.rewrittenContent,
      data.summary || null,
      JSON.stringify(data.keyPoints || []),
      data.processingTimeMs || null,
      data.aiCost || null,
    ]);

    return this.mapRowToRewrittenArticle(result.rows[0]);
  }

  private async incrementStyleUsage(styleProfileId: string): Promise<void> {
    await this.db.query(
      'UPDATE style_profiles SET usage_count = usage_count + 1 WHERE id = $1',
      [styleProfileId]
    );
  }

  private mapRowToRewrittenArticle(row: any): RewrittenArticle {
    return {
      id: row.id,
      articleId: row.article_id,
      userId: row.user_id,
      styleProfileId: row.style_profile_id,
      rewrittenContent: row.rewritten_content,
      summary: row.summary,
      keyPoints: row.key_points ? JSON.parse(row.key_points) : undefined,
      processingTimeMs: row.processing_time_ms,
      aiCost: row.ai_cost ? parseFloat(row.ai_cost) : undefined,
      createdAt: row.created_at,
    };
  }

  private mapRowToRewrittenArticleWithDetails(
    row: any,
    citations: Citation[]
  ): RewrittenArticleWithDetails {
    return {
      id: row.id,
      articleId: row.article_id,
      userId: row.user_id,
      styleProfileId: row.style_profile_id,
      rewrittenContent: row.rewritten_content,
      summary: row.summary,
      keyPoints: row.key_points ? JSON.parse(row.key_points) : undefined,
      processingTimeMs: row.processing_time_ms,
      aiCost: row.ai_cost ? parseFloat(row.ai_cost) : undefined,
      createdAt: row.created_at,
      article: {
        id: row.article_id,
        sourceId: row.source_id,
        title: row.title,
        originalContent: row.original_content,
        url: row.url,
        author: row.author,
        publishedAt: row.published_at,
        category: row.category,
        imageUrl: row.image_url,
        importanceScore: row.importance_score,
        createdAt: row.article_created_at,
        updatedAt: row.article_updated_at,
        source: {
          id: row.source_id,
          name: row.source_name,
          url: row.source_url,
          reliabilityScore: row.reliability_score,
          favicon: row.favicon,
          isActive: row.is_active,
          createdAt: row.source_created_at,
          updatedAt: row.source_updated_at,
        },
      },
      citations,
    };
  }
}
