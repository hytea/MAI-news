import crypto from 'crypto';
import { Pool } from 'pg';

export interface DeduplicationResult {
  isDuplicate: boolean;
  existingArticleId?: string;
  contentHash: string;
}

export class DeduplicationService {
  constructor(private db: Pool) {}

  /**
   * Generate a content hash for deduplication
   * Uses title and first 500 chars of content to create a unique hash
   */
  generateContentHash(title: string, content: string): string {
    // Normalize text: lowercase, remove extra whitespace, remove punctuation
    const normalizedTitle = this.normalizeText(title);
    const normalizedContent = this.normalizeText(content.substring(0, 500));

    // Combine and hash
    const combined = `${normalizedTitle}|||${normalizedContent}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Check if an article is a duplicate based on URL or content hash
   */
  async checkDuplicate(
    url: string,
    contentHash: string
  ): Promise<DeduplicationResult> {
    try {
      // First check by URL (exact match)
      const urlResult = await this.db.query(
        'SELECT id FROM articles WHERE url = $1 LIMIT 1',
        [url]
      );

      if (urlResult.rows.length > 0) {
        return {
          isDuplicate: true,
          existingArticleId: urlResult.rows[0].id,
          contentHash,
        };
      }

      // Then check by content hash (duplicate content on different URL)
      const hashResult = await this.db.query(
        'SELECT id FROM articles WHERE content_hash = $1 LIMIT 1',
        [contentHash]
      );

      if (hashResult.rows.length > 0) {
        return {
          isDuplicate: true,
          existingArticleId: hashResult.rows[0].id,
          contentHash,
        };
      }

      return {
        isDuplicate: false,
        contentHash,
      };
    } catch (error) {
      console.error('Error checking for duplicate:', error);
      // In case of error, treat as non-duplicate to avoid losing articles
      return {
        isDuplicate: false,
        contentHash,
      };
    }
  }

  /**
   * Find similar articles based on content hash similarity
   * Useful for finding near-duplicates
   */
  async findSimilarArticles(
    title: string,
    content: string,
    limit: number = 5
  ): Promise<string[]> {
    try {
      const normalizedTitle = this.normalizeText(title);

      // Use PostgreSQL's similarity functions if available (requires pg_trgm extension)
      // For now, we'll use a simple title-based similarity search
      const result = await this.db.query(
        `
        SELECT id, title,
               similarity(lower(title), $1) as sim_score
        FROM articles
        WHERE similarity(lower(title), $1) > 0.5
        ORDER BY sim_score DESC
        LIMIT $2
        `,
        [normalizedTitle, limit]
      );

      return result.rows.map((row) => row.id);
    } catch (error) {
      // If similarity function is not available, fall back to basic search
      console.warn('Similarity search not available, using basic search');
      return [];
    }
  }

  /**
   * Remove duplicate articles from a list based on content hash
   */
  async filterDuplicates(
    articles: Array<{ url: string; title: string; content: string }>
  ): Promise<Array<{ url: string; title: string; content: string; contentHash: string; isDuplicate: boolean }>> {
    const results = [];

    for (const article of articles) {
      const contentHash = this.generateContentHash(article.title, article.content);
      const dedupeResult = await this.checkDuplicate(article.url, contentHash);

      results.push({
        ...article,
        contentHash,
        isDuplicate: dedupeResult.isDuplicate,
      });
    }

    return results;
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Calculate similarity score between two texts (0-1)
   * Uses Jaccard similarity on word sets
   */
  calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(this.normalizeText(text1).split(' '));
    const words2 = new Set(this.normalizeText(text2).split(' '));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Batch check for duplicates (more efficient for large sets)
   */
  async batchCheckDuplicates(
    articles: Array<{ url: string; contentHash: string }>
  ): Promise<Map<string, boolean>> {
    const urlMap = new Map<string, boolean>();

    if (articles.length === 0) {
      return urlMap;
    }

    try {
      // Check URLs in batch
      const urls = articles.map(a => a.url);
      const hashes = articles.map(a => a.contentHash);

      const result = await this.db.query(
        'SELECT url, content_hash FROM articles WHERE url = ANY($1) OR content_hash = ANY($2)',
        [urls, hashes]
      );

      // Create a set of existing URLs and hashes
      const existingUrls = new Set(result.rows.map(r => r.url));
      const existingHashes = new Set(result.rows.map(r => r.content_hash));

      // Map each article to its duplicate status
      for (const article of articles) {
        const isDuplicate =
          existingUrls.has(article.url) || existingHashes.has(article.contentHash);
        urlMap.set(article.url, isDuplicate);
      }

      return urlMap;
    } catch (error) {
      console.error('Error in batch duplicate check:', error);
      // Return all as non-duplicates on error
      articles.forEach(a => urlMap.set(a.url, false));
      return urlMap;
    }
  }
}
