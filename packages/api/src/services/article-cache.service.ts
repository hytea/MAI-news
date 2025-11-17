import { Redis } from 'ioredis';
import { RewrittenArticle, RewrittenArticleWithDetails } from '@news-curator/shared';

/**
 * Service for caching rewritten articles in Redis
 */
export class ArticleCacheService {
  private readonly CACHE_PREFIX = 'rewritten_article:';
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly USER_CACHE_PREFIX = 'user_rewrites:';

  constructor(private redis: Redis) {}

  /**
   * Generate cache key for a rewritten article
   */
  private getCacheKey(articleId: string, userId: string, styleProfileId: string): string {
    return `${this.CACHE_PREFIX}${articleId}:${userId}:${styleProfileId}`;
  }

  /**
   * Generate cache key for user's rewritten articles list
   */
  private getUserCacheKey(userId: string): string {
    return `${this.USER_CACHE_PREFIX}${userId}`;
  }

  /**
   * Cache a rewritten article
   */
  async cacheRewrittenArticle(
    article: RewrittenArticle,
    ttl: number = this.CACHE_TTL
  ): Promise<void> {
    const key = this.getCacheKey(article.articleId, article.userId, article.styleProfileId);

    try {
      await this.redis.setex(key, ttl, JSON.stringify(article));
    } catch (error) {
      console.error('Failed to cache rewritten article:', error);
      // Don't throw - caching failure shouldn't break the application
    }
  }

  /**
   * Cache a rewritten article with full details (includes citations and original article)
   */
  async cacheRewrittenArticleWithDetails(
    article: RewrittenArticleWithDetails,
    ttl: number = this.CACHE_TTL
  ): Promise<void> {
    const key = this.getCacheKey(article.articleId, article.userId, article.styleProfileId);

    try {
      await this.redis.setex(key, ttl, JSON.stringify(article));

      // Also add to user's cache list
      const userKey = this.getUserCacheKey(article.userId);
      await this.redis.sadd(userKey, key);
      await this.redis.expire(userKey, ttl);
    } catch (error) {
      console.error('Failed to cache rewritten article with details:', error);
    }
  }

  /**
   * Get a cached rewritten article
   */
  async getCachedArticle(
    articleId: string,
    userId: string,
    styleProfileId: string
  ): Promise<RewrittenArticle | null> {
    const key = this.getCacheKey(articleId, userId, styleProfileId);

    try {
      const cached = await this.redis.get(key);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached);
    } catch (error) {
      console.error('Failed to get cached rewritten article:', error);
      return null;
    }
  }

  /**
   * Get a cached rewritten article with details
   */
  async getCachedArticleWithDetails(
    articleId: string,
    userId: string,
    styleProfileId: string
  ): Promise<RewrittenArticleWithDetails | null> {
    const key = this.getCacheKey(articleId, userId, styleProfileId);

    try {
      const cached = await this.redis.get(key);

      if (!cached) {
        return null;
      }

      const article = JSON.parse(cached);

      // Convert date strings back to Date objects
      if (article.createdAt) {
        article.createdAt = new Date(article.createdAt);
      }
      if (article.article?.createdAt) {
        article.article.createdAt = new Date(article.article.createdAt);
      }
      if (article.article?.updatedAt) {
        article.article.updatedAt = new Date(article.article.updatedAt);
      }
      if (article.article?.publishedAt) {
        article.article.publishedAt = new Date(article.article.publishedAt);
      }

      return article;
    } catch (error) {
      console.error('Failed to get cached rewritten article with details:', error);
      return null;
    }
  }

  /**
   * Invalidate cache for a specific rewritten article
   */
  async invalidateCache(articleId: string, userId: string, styleProfileId: string): Promise<void> {
    const key = this.getCacheKey(articleId, userId, styleProfileId);

    try {
      await this.redis.del(key);

      // Remove from user's cache list
      const userKey = this.getUserCacheKey(userId);
      await this.redis.srem(userKey, key);
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    }
  }

  /**
   * Invalidate all cached rewrites for an article (across all users and styles)
   */
  async invalidateArticleCache(articleId: string): Promise<void> {
    try {
      const pattern = `${this.CACHE_PREFIX}${articleId}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Failed to invalidate article cache:', error);
    }
  }

  /**
   * Invalidate all cached rewrites for a user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const userKey = this.getUserCacheKey(userId);
      const keys = await this.redis.smembers(userKey);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        await this.redis.del(userKey);
      }
    } catch (error) {
      console.error('Failed to invalidate user cache:', error);
    }
  }

  /**
   * Invalidate all cached rewrites for a style profile
   */
  async invalidateStyleProfileCache(styleProfileId: string): Promise<void> {
    try {
      const pattern = `${this.CACHE_PREFIX}*:${styleProfileId}`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Failed to invalidate style profile cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalCachedArticles: number;
    memoryUsed: string;
  }> {
    try {
      const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);

      return {
        totalCachedArticles: keys.length,
        memoryUsed: memoryMatch ? memoryMatch[1] : 'unknown',
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalCachedArticles: 0,
        memoryUsed: 'unknown',
      };
    }
  }

  /**
   * Clear all cached rewritten articles (use with caution)
   */
  async clearAllCache(): Promise<void> {
    try {
      const articleKeys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
      const userKeys = await this.redis.keys(`${this.USER_CACHE_PREFIX}*`);
      const allKeys = [...articleKeys, ...userKeys];

      if (allKeys.length > 0) {
        await this.redis.del(...allKeys);
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }
}
