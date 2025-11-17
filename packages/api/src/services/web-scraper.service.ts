import axios from 'axios';
import * as cheerio from 'cheerio';
import { ArticleCategory } from '@news-curator/shared';

export interface ScrapedArticle {
  title: string;
  content: string;
  url: string;
  author?: string;
  publishedAt: Date;
  imageUrl?: string;
  category?: ArticleCategory;
}

export interface ScrapeResult {
  article: ScrapedArticle;
}

export class WebScraperService {
  private readonly USER_AGENT =
    'Mozilla/5.0 (compatible; NewsIngestionBot/1.0; +https://news-curator.com/bot)';
  private readonly REQUEST_TIMEOUT = 15000; // 15 seconds

  /**
   * Scrape an article from a given URL
   */
  async scrapeArticle(url: string): Promise<ScrapeResult> {
    try {
      const html = await this.fetchHtml(url);
      const $ = cheerio.load(html);

      // Extract article metadata and content
      const title = this.extractTitle($);
      const content = this.extractContent($);
      const author = this.extractAuthor($);
      const publishedAt = this.extractPublishedDate($);
      const imageUrl = this.extractImageUrl($, url);

      if (!title || !content) {
        throw new Error('Failed to extract title or content from article');
      }

      return {
        article: {
          title,
          content,
          url,
          author,
          publishedAt,
          imageUrl,
          category: this.categorizeContent(title, content),
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to scrape article ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Fetch HTML content from URL
   */
  private async fetchHtml(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        timeout: this.REQUEST_TIMEOUT,
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        maxRedirects: 5,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`HTTP request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Extract article title using multiple strategies
   */
  private extractTitle($: cheerio.CheerioAPI): string {
    // Try Open Graph title
    let title = $('meta[property="og:title"]').attr('content');
    if (title) return this.cleanText(title);

    // Try Twitter card title
    title = $('meta[name="twitter:title"]').attr('content');
    if (title) return this.cleanText(title);

    // Try article title meta
    title = $('meta[name="title"]').attr('content');
    if (title) return this.cleanText(title);

    // Try h1 tag
    title = $('article h1').first().text() || $('h1').first().text();
    if (title) return this.cleanText(title);

    // Fallback to page title
    title = $('title').text();
    return this.cleanText(title);
  }

  /**
   * Extract article content using multiple strategies
   */
  private extractContent($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .advertisement, .ad, .social-share').remove();

    // Try common article selectors
    const articleSelectors = [
      'article[role="main"]',
      'article',
      '[role="main"] article',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      'main article',
      'main',
    ];

    for (const selector of articleSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const content = this.extractTextFromElement($, element);
        if (content.length > 200) {
          // Minimum content length
          return content;
        }
      }
    }

    // Fallback: try to find the largest text block
    const paragraphs = $('p');
    let content = '';
    paragraphs.each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 50) {
        content += text + '\n\n';
      }
    });

    return content.trim();
  }

  /**
   * Extract text content from a cheerio element
   */
  private extractTextFromElement($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): string {
    // Get all paragraph and heading text
    const textElements: string[] = [];

    element.find('p, h1, h2, h3, h4, h5, h6, li').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 0) {
        textElements.push(text);
      }
    });

    return textElements.join('\n\n').trim();
  }

  /**
   * Extract author name
   */
  private extractAuthor($: cheerio.CheerioAPI): string | undefined {
    // Try meta tags
    let author = $('meta[name="author"]').attr('content');
    if (author) return this.cleanText(author);

    author = $('meta[property="article:author"]').attr('content');
    if (author) return this.cleanText(author);

    // Try common author selectors
    const authorSelectors = [
      '.author-name',
      '.author',
      '[rel="author"]',
      '.byline',
      '[itemprop="author"]',
    ];

    for (const selector of authorSelectors) {
      const element = $(selector).first();
      if (element.length) {
        author = element.text();
        if (author) return this.cleanText(author);
      }
    }

    return undefined;
  }

  /**
   * Extract published date
   */
  private extractPublishedDate($: cheerio.CheerioAPI): Date {
    // Try meta tags
    let dateString = $('meta[property="article:published_time"]').attr('content');
    if (!dateString) {
      dateString = $('meta[name="publishdate"]').attr('content');
    }
    if (!dateString) {
      dateString = $('time[datetime]').attr('datetime');
    }
    if (!dateString) {
      dateString = $('[itemprop="datePublished"]').attr('content');
    }

    if (dateString) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Fallback to current date
    return new Date();
  }

  /**
   * Extract main image URL
   */
  private extractImageUrl($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
    // Try Open Graph image
    let imageUrl = $('meta[property="og:image"]').attr('content');
    if (imageUrl) return this.resolveUrl(imageUrl, baseUrl);

    // Try Twitter card image
    imageUrl = $('meta[name="twitter:image"]').attr('content');
    if (imageUrl) return this.resolveUrl(imageUrl, baseUrl);

    // Try article image
    imageUrl = $('article img').first().attr('src');
    if (imageUrl) return this.resolveUrl(imageUrl, baseUrl);

    // Try first large image
    const images = $('img');
    for (let i = 0; i < images.length; i++) {
      const src = $(images[i]).attr('src');
      const width = $(images[i]).attr('width');
      const height = $(images[i]).attr('height');

      if (src && (!width || !height || parseInt(width) > 200)) {
        return this.resolveUrl(src, baseUrl);
      }
    }

    return undefined;
  }

  /**
   * Resolve relative URL to absolute URL
   */
  private resolveUrl(url: string, baseUrl: string): string {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }

  /**
   * Clean text by removing extra whitespace
   */
  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Categorize content based on title and text
   */
  private categorizeContent(title: string, content: string): ArticleCategory {
    const text = `${title} ${content}`.toLowerCase();

    const categories: Record<ArticleCategory, string[]> = {
      [ArticleCategory.POLITICS]: [
        'politics',
        'election',
        'government',
        'congress',
        'senate',
        'president',
        'vote',
        'policy',
      ],
      [ArticleCategory.TECHNOLOGY]: [
        'technology',
        'tech',
        'software',
        'ai',
        'computer',
        'startup',
        'app',
        'digital',
      ],
      [ArticleCategory.BUSINESS]: [
        'business',
        'economy',
        'market',
        'stock',
        'finance',
        'investment',
        'company',
      ],
      [ArticleCategory.SCIENCE]: [
        'science',
        'research',
        'study',
        'scientist',
        'discovery',
        'experiment',
      ],
      [ArticleCategory.HEALTH]: [
        'health',
        'medical',
        'medicine',
        'doctor',
        'hospital',
        'disease',
        'treatment',
      ],
      [ArticleCategory.ENTERTAINMENT]: [
        'entertainment',
        'movie',
        'film',
        'music',
        'celebrity',
        'actor',
        'show',
      ],
      [ArticleCategory.SPORTS]: [
        'sports',
        'game',
        'team',
        'player',
        'score',
        'championship',
        'league',
      ],
      [ArticleCategory.WORLD]: [
        'world',
        'international',
        'global',
        'foreign',
        'country',
        'nation',
      ],
      [ArticleCategory.OTHER]: [],
    };

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
   * Check if a URL is accessible and returns HTML content
   */
  async validateUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        headers: {
          'User-Agent': this.USER_AGENT,
        },
        maxRedirects: 5,
      });

      const contentType = response.headers['content-type'];
      return contentType ? contentType.includes('text/html') : false;
    } catch {
      return false;
    }
  }
}
