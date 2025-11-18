import { ArticleCacheService } from '../article-cache.service';
import { RewrittenArticle, RewrittenArticleWithDetails, ArticleCategory } from '@news-curator/shared';
import { createMockRedis, MockRedis } from '../../__tests__/mocks/redis.mock';

describe('ArticleCacheService', () => {
  let cacheService: ArticleCacheService;
  let mockRedis: MockRedis;

  const mockRewrittenArticle: RewrittenArticle = {
    id: 'rewritten-123',
    articleId: 'article-123',
    userId: 'user-123',
    styleProfileId: 'style-123',
    rewrittenContent: 'Rewritten content here',
    summary: 'Article summary',
    keyPoints: ['Point 1', 'Point 2'],
    createdAt: new Date('2024-01-01'),
  };

  const mockRewrittenArticleWithDetails: RewrittenArticleWithDetails = {
    ...mockRewrittenArticle,
    article: {
      id: 'article-123',
      title: 'Test Article',
      originalContent: 'Original content',
      url: 'https://example.com/article',
      sourceId: 'source-123',
      author: 'Test Author',
      publishedAt: new Date('2024-01-01'),
      category: ArticleCategory.TECHNOLOGY,
      imageUrl: 'https://example.com/image.jpg',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      source: {
        id: 'source-123',
        name: 'Test Source',
        url: 'https://example.com',
        isActive: true,
        reliabilityScore: 85,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    },
    citations: [
      {
        id: 'citation-1',
        rewrittenArticleId: 'rewritten-123',
        text: 'Quote from source',
        url: 'https://example.com/source',
        position: 0,
        createdAt: new Date('2024-01-01'),
      },
    ],
  };

  beforeEach(() => {
    mockRedis = createMockRedis();
    cacheService = new ArticleCacheService(mockRedis as any);
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockRedis.clearMocks();
  });

  describe('cacheRewrittenArticle', () => {
    it('should cache a rewritten article with default TTL', async () => {
      await cacheService.cacheRewrittenArticle(mockRewrittenArticle);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'rewritten_article:article-123:user-123:style-123',
        24 * 60 * 60, // 24 hours
        JSON.stringify(mockRewrittenArticle)
      );
    });

    it('should cache a rewritten article with custom TTL', async () => {
      const customTTL = 3600; // 1 hour

      await cacheService.cacheRewrittenArticle(mockRewrittenArticle, customTTL);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'rewritten_article:article-123:user-123:style-123',
        customTTL,
        JSON.stringify(mockRewrittenArticle)
      );
    });

    it('should not throw error if Redis fails', async () => {
      mockRedis.setex.mockRejectedValueOnce(new Error('Redis error'));

      await expect(
        cacheService.cacheRewrittenArticle(mockRewrittenArticle)
      ).resolves.not.toThrow();
    });
  });

  describe('cacheRewrittenArticleWithDetails', () => {
    it('should cache article with details and add to user cache list', async () => {
      await cacheService.cacheRewrittenArticleWithDetails(mockRewrittenArticleWithDetails);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'rewritten_article:article-123:user-123:style-123',
        24 * 60 * 60,
        JSON.stringify(mockRewrittenArticleWithDetails)
      );

      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'user_rewrites:user-123',
        'rewritten_article:article-123:user-123:style-123'
      );

      expect(mockRedis.expire).toHaveBeenCalledWith(
        'user_rewrites:user-123',
        24 * 60 * 60
      );
    });

    it('should not throw error if Redis fails', async () => {
      mockRedis.setex.mockRejectedValueOnce(new Error('Redis error'));

      await expect(
        cacheService.cacheRewrittenArticleWithDetails(mockRewrittenArticleWithDetails)
      ).resolves.not.toThrow();
    });
  });

  describe('getCachedArticle', () => {
    it('should retrieve cached article', async () => {
      const serialized = JSON.stringify(mockRewrittenArticle);
      mockRedis.get.mockResolvedValueOnce(serialized);

      const result = await cacheService.getCachedArticle(
        'article-123',
        'user-123',
        'style-123'
      );

      // When JSON.parse is called, dates become strings
      const expected = { ...mockRewrittenArticle, createdAt: mockRewrittenArticle.createdAt.toISOString() };
      expect(result).toEqual(expected);
      expect(mockRedis.get).toHaveBeenCalledWith(
        'rewritten_article:article-123:user-123:style-123'
      );
    });

    it('should return null if article not in cache', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await cacheService.getCachedArticle(
        'article-123',
        'user-123',
        'style-123'
      );

      expect(result).toBeNull();
    });

    it('should return null if Redis fails', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('Redis error'));

      const result = await cacheService.getCachedArticle(
        'article-123',
        'user-123',
        'style-123'
      );

      expect(result).toBeNull();
    });

    it('should parse JSON correctly', async () => {
      const article = { ...mockRewrittenArticle, keyPoints: ['A', 'B', 'C'] };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(article));

      const result = await cacheService.getCachedArticle(
        'article-123',
        'user-123',
        'style-123'
      );

      expect(result?.keyPoints).toEqual(['A', 'B', 'C']);
    });
  });

  describe('getCachedArticleWithDetails', () => {
    it('should retrieve cached article with details', async () => {
      const serialized = JSON.stringify(mockRewrittenArticleWithDetails);
      mockRedis.get.mockResolvedValueOnce(serialized);

      const result = await cacheService.getCachedArticleWithDetails(
        'article-123',
        'user-123',
        'style-123'
      );

      expect(result).toBeDefined();
      expect(result?.article).toBeDefined();
      expect(result?.citations).toBeDefined();
    });

    it('should convert date strings back to Date objects', async () => {
      const serialized = JSON.stringify(mockRewrittenArticleWithDetails);
      mockRedis.get.mockResolvedValueOnce(serialized);

      const result = await cacheService.getCachedArticleWithDetails(
        'article-123',
        'user-123',
        'style-123'
      );

      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.article?.createdAt).toBeInstanceOf(Date);
      expect(result?.article?.updatedAt).toBeInstanceOf(Date);
      expect(result?.article?.publishedAt).toBeInstanceOf(Date);
    });

    it('should return null if not in cache', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await cacheService.getCachedArticleWithDetails(
        'article-123',
        'user-123',
        'style-123'
      );

      expect(result).toBeNull();
    });
  });

  describe('invalidateCache', () => {
    it('should delete cache entry and remove from user cache list', async () => {
      mockRedis.del.mockResolvedValueOnce(1);
      mockRedis.srem = jest.fn().mockResolvedValueOnce(1);

      await cacheService.invalidateCache('article-123', 'user-123', 'style-123');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'rewritten_article:article-123:user-123:style-123'
      );
      expect(mockRedis.srem).toHaveBeenCalledWith(
        'user_rewrites:user-123',
        'rewritten_article:article-123:user-123:style-123'
      );
    });

    it('should not throw error if Redis fails', async () => {
      mockRedis.del.mockRejectedValueOnce(new Error('Redis error'));

      await expect(
        cacheService.invalidateCache('article-123', 'user-123', 'style-123')
      ).resolves.not.toThrow();
    });
  });

  describe('invalidateArticleCache', () => {
    it('should delete all cache entries for an article', async () => {
      const keys = [
        'rewritten_article:article-123:user-1:style-1',
        'rewritten_article:article-123:user-2:style-2',
        'rewritten_article:article-123:user-1:style-3',
      ];

      mockRedis.keys.mockResolvedValueOnce(keys);
      mockRedis.del.mockResolvedValueOnce(keys.length);

      await cacheService.invalidateArticleCache('article-123');

      expect(mockRedis.keys).toHaveBeenCalledWith('rewritten_article:article-123:*');
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });

    it('should handle empty keys array', async () => {
      mockRedis.keys.mockResolvedValueOnce([]);

      await cacheService.invalidateArticleCache('article-123');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('invalidateUserCache', () => {
    it('should delete all cache entries for a user', async () => {
      const keys = [
        'rewritten_article:article-1:user-123:style-1',
        'rewritten_article:article-2:user-123:style-2',
      ];

      mockRedis.smembers = jest.fn().mockResolvedValueOnce(keys);
      mockRedis.del.mockResolvedValue(keys.length);

      await cacheService.invalidateUserCache('user-123');

      expect(mockRedis.smembers).toHaveBeenCalledWith('user_rewrites:user-123');
      expect(mockRedis.del).toHaveBeenNthCalledWith(1, ...keys);
      expect(mockRedis.del).toHaveBeenNthCalledWith(2, 'user_rewrites:user-123');
    });

    it('should handle empty keys array', async () => {
      mockRedis.smembers = jest.fn().mockResolvedValueOnce([]);

      await cacheService.invalidateUserCache('user-123');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('invalidateStyleProfileCache', () => {
    it('should delete all cache entries for a style profile', async () => {
      const keys = [
        'rewritten_article:article-1:user-1:style-123',
        'rewritten_article:article-2:user-2:style-123',
      ];

      mockRedis.keys.mockResolvedValueOnce(keys);
      mockRedis.del.mockResolvedValueOnce(keys.length);

      await cacheService.invalidateStyleProfileCache('style-123');

      expect(mockRedis.keys).toHaveBeenCalledWith('rewritten_article:*:style-123');
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const keys = ['key1', 'key2', 'key3'];
      mockRedis.keys.mockResolvedValueOnce(keys);
      mockRedis.info = jest.fn().mockResolvedValueOnce('used_memory_human:10M\r\n');

      const stats = await cacheService.getCacheStats();

      expect(stats.totalCachedArticles).toBe(3);
      expect(stats.memoryUsed).toBe('10M');
    });

    it('should handle missing memory info', async () => {
      mockRedis.keys.mockResolvedValueOnce([]);
      mockRedis.info = jest.fn().mockResolvedValueOnce('some_other_info');

      const stats = await cacheService.getCacheStats();

      expect(stats.totalCachedArticles).toBe(0);
      expect(stats.memoryUsed).toBe('unknown');
    });

    it('should return default values on error', async () => {
      mockRedis.keys.mockRejectedValueOnce(new Error('Redis error'));

      const stats = await cacheService.getCacheStats();

      expect(stats.totalCachedArticles).toBe(0);
      expect(stats.memoryUsed).toBe('unknown');
    });
  });

  describe('clearAllCache', () => {
    it('should clear all cached articles and user lists', async () => {
      const articleKeys = ['rewritten_article:1', 'rewritten_article:2'];
      const userKeys = ['user_rewrites:1', 'user_rewrites:2'];

      mockRedis.keys.mockResolvedValueOnce(articleKeys);
      mockRedis.keys.mockResolvedValueOnce(userKeys);
      mockRedis.del.mockResolvedValueOnce(4);

      await cacheService.clearAllCache();

      expect(mockRedis.keys).toHaveBeenCalledWith('rewritten_article:*');
      expect(mockRedis.keys).toHaveBeenCalledWith('user_rewrites:*');
      expect(mockRedis.del).toHaveBeenCalledWith(...articleKeys, ...userKeys);
    });

    it('should handle empty cache', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await cacheService.clearAllCache();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should throw error if clear fails', async () => {
      mockRedis.keys.mockRejectedValueOnce(new Error('Redis connection error'));

      await expect(cacheService.clearAllCache()).rejects.toThrow('Redis connection error');
    });
  });
});
