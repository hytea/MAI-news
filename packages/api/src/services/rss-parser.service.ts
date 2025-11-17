import Parser from 'rss-parser';
import { ArticleCategory } from '@news-curator/shared';

export interface ParsedArticle {
  title: string;
  content: string;
  url: string;
  author?: string;
  publishedAt: Date;
  imageUrl?: string;
  category?: ArticleCategory;
}

export interface RSSParseResult {
  articles: ParsedArticle[];
  feedTitle?: string;
  feedDescription?: string;
}

export class RSSParserService {
  private parser: Parser;

  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      customFields: {
        item: [
          ['media:content', 'mediaContent'],
          ['media:thumbnail', 'mediaThumbnail'],
          ['content:encoded', 'contentEncoded'],
          ['description', 'description'],
        ],
      },
    });
  }

  /**
   * Parse an RSS/Atom feed from a given URL
   */
  async parseFeed(feedUrl: string): Promise<RSSParseResult> {
    try {
      const feed = await this.parser.parseURL(feedUrl);

      const articles: ParsedArticle[] = feed.items
        .filter((item) => item.link && item.title)
        .map((item) => {
          const content = this.extractContent(item);
          const imageUrl = this.extractImageUrl(item);
          const publishedAt = this.parseDate(item.pubDate || item.isoDate);

          return {
            title: this.cleanText(item.title!),
            content,
            url: item.link!,
            author: item.creator || item.author,
            publishedAt,
            imageUrl,
            category: this.categorizeArticle(item.title!, content),
          };
        });

      return {
        articles,
        feedTitle: feed.title,
        feedDescription: feed.description,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse RSS feed ${feedUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract content from RSS item, preferring richer content fields
   */
  private extractContent(item: any): string {
    // Try different content fields in order of preference
    const contentFields = [
      item.contentEncoded,
      item['content:encoded'],
      item.content,
      item.description,
      item.summary,
    ];

    for (const field of contentFields) {
      if (field && typeof field === 'string' && field.trim().length > 0) {
        return this.cleanHtml(field);
      }
    }

    return '';
  }

  /**
   * Extract image URL from various RSS item fields
   */
  private extractImageUrl(item: any): string | undefined {
    // Try media content
    if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
      return item.mediaContent.$.url;
    }

    // Try media thumbnail
    if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
      return item.mediaThumbnail.$.url;
    }

    // Try enclosure
    if (item.enclosure && item.enclosure.url) {
      const url = item.enclosure.url;
      if (this.isImageUrl(url)) {
        return url;
      }
    }

    // Try to extract from content
    if (item.content || item.description) {
      const content = item.content || item.description;
      const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
      if (imgMatch && imgMatch[1]) {
        return imgMatch[1];
      }
    }

    return undefined;
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateString?: string): Date {
    if (!dateString) {
      return new Date();
    }

    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date() : date;
  }

  /**
   * Clean HTML tags from text
   */
  private cleanHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Clean text by removing extra whitespace
   */
  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Check if URL is likely an image
   */
  private isImageUrl(url: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some((ext) => lowerUrl.includes(ext));
  }

  /**
   * Categorize article based on title and content
   * This is a simple keyword-based categorization
   */
  private categorizeArticle(title: string, content: string): ArticleCategory {
    const text = `${title} ${content}`.toLowerCase();

    const categories: Record<ArticleCategory, string[]> = {
      [ArticleCategory.POLITICS]: ['politics', 'election', 'government', 'congress', 'senate', 'president', 'vote', 'policy', 'democrat', 'republican'],
      [ArticleCategory.TECHNOLOGY]: ['technology', 'tech', 'software', 'ai', 'artificial intelligence', 'computer', 'startup', 'silicon valley', 'app', 'digital'],
      [ArticleCategory.BUSINESS]: ['business', 'economy', 'market', 'stock', 'finance', 'investment', 'company', 'corporate', 'revenue', 'profit'],
      [ArticleCategory.SCIENCE]: ['science', 'research', 'study', 'scientist', 'discovery', 'experiment', 'laboratory', 'physics', 'chemistry', 'biology'],
      [ArticleCategory.HEALTH]: ['health', 'medical', 'medicine', 'doctor', 'hospital', 'disease', 'treatment', 'patient', 'vaccine', 'covid'],
      [ArticleCategory.ENTERTAINMENT]: ['entertainment', 'movie', 'film', 'music', 'celebrity', 'actor', 'actress', 'show', 'concert', 'album'],
      [ArticleCategory.SPORTS]: ['sports', 'game', 'team', 'player', 'score', 'championship', 'league', 'football', 'basketball', 'soccer'],
      [ArticleCategory.WORLD]: ['world', 'international', 'global', 'foreign', 'country', 'nation', 'war', 'conflict', 'diplomatic'],
      [ArticleCategory.OTHER]: [],
    };

    // Count keyword matches for each category
    let bestCategory = ArticleCategory.OTHER;
    let maxMatches = 0;

    for (const [category, keywords] of Object.entries(categories)) {
      const matches = keywords.filter((keyword) => text.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestCategory = category as ArticleCategory;
      }
    }

    return bestCategory;
  }

  /**
   * Validate if a URL is a valid RSS/Atom feed
   */
  async validateFeed(feedUrl: string): Promise<boolean> {
    try {
      await this.parser.parseURL(feedUrl);
      return true;
    } catch (error) {
      return false;
    }
  }
}
