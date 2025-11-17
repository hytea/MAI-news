import { Worker, Job } from 'bullmq';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { createRedisConnection, NewsIngestionJobData, QUEUE_NAMES } from '../config/redis';
import { RSSParserService } from '../services/rss-parser.service';
import { WebScraperService } from '../services/web-scraper.service';
import { DeduplicationService } from '../services/deduplication.service';

export class IngestionWorker {
  private worker: Worker<NewsIngestionJobData>;
  private rssParser: RSSParserService;
  private webScraper: WebScraperService;
  private deduplicationService: DeduplicationService;

  constructor(private db: Pool) {
    this.rssParser = new RSSParserService();
    this.webScraper = new WebScraperService();
    this.deduplicationService = new DeduplicationService(db);

    this.worker = new Worker<NewsIngestionJobData>(
      QUEUE_NAMES.NEWS_INGESTION,
      async (job) => this.processJob(job),
      {
        connection: createRedisConnection(),
        concurrency: 5, // Process up to 5 jobs concurrently
        limiter: {
          max: 10, // Max 10 jobs
          duration: 1000, // per second
        },
      }
    );

    this.setupEventListeners();
  }

  /**
   * Process an ingestion job
   */
  private async processJob(job: Job<NewsIngestionJobData>): Promise<void> {
    const { sourceId, jobType, url } = job.data;

    console.log(`Processing ${jobType} job for source ${sourceId}: ${url}`);

    // Create ingestion log
    const logId = await this.createIngestionLog(sourceId, jobType);

    try {
      await this.updateIngestionLog(logId, {
        status: 'processing',
        started_at: new Date(),
      });

      let articlesFound = 0;
      let articlesAdded = 0;
      let articlesSkipped = 0;

      if (jobType === 'rss') {
        const result = await this.processRSSFeed(sourceId, url);
        articlesFound = result.found;
        articlesAdded = result.added;
        articlesSkipped = result.skipped;
      } else if (jobType === 'scrape') {
        const result = await this.processWebScrape(sourceId, url);
        articlesFound = result.found;
        articlesAdded = result.added;
        articlesSkipped = result.skipped;
      }

      // Update source last_fetched_at
      await this.updateSourceLastFetched(sourceId);

      // Mark job as completed
      await this.updateIngestionLog(logId, {
        status: 'completed',
        completed_at: new Date(),
        articles_found: articlesFound,
        articles_added: articlesAdded,
        articles_skipped: articlesSkipped,
      });

      console.log(
        `Completed ${jobType} job for source ${sourceId}: ${articlesAdded}/${articlesFound} articles added`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error processing ${jobType} job for source ${sourceId}:`, errorMessage);

      await this.updateIngestionLog(logId, {
        status: 'failed',
        completed_at: new Date(),
        error_message: errorMessage,
      });

      throw error; // Re-throw to let BullMQ handle retry logic
    }
  }

  /**
   * Process RSS feed ingestion
   */
  private async processRSSFeed(
    sourceId: string,
    feedUrl: string
  ): Promise<{ found: number; added: number; skipped: number }> {
    const parseResult = await this.rssParser.parseFeed(feedUrl);
    const articles = parseResult.articles;

    let added = 0;
    let skipped = 0;

    for (const article of articles) {
      const contentHash = this.deduplicationService.generateContentHash(
        article.title,
        article.content
      );

      const dedupeResult = await this.deduplicationService.checkDuplicate(
        article.url,
        contentHash
      );

      if (dedupeResult.isDuplicate) {
        skipped++;
        continue;
      }

      // Insert article into database
      await this.insertArticle({
        sourceId,
        title: article.title,
        content: article.content,
        url: article.url,
        author: article.author,
        publishedAt: article.publishedAt,
        imageUrl: article.imageUrl,
        category: article.category,
        contentHash,
      });

      added++;
    }

    return {
      found: articles.length,
      added,
      skipped,
    };
  }

  /**
   * Process web scraping ingestion
   */
  private async processWebScrape(
    sourceId: string,
    url: string
  ): Promise<{ found: number; added: number; skipped: number }> {
    const scrapeResult = await this.webScraper.scrapeArticle(url);
    const article = scrapeResult.article;

    const contentHash = this.deduplicationService.generateContentHash(
      article.title,
      article.content
    );

    const dedupeResult = await this.deduplicationService.checkDuplicate(
      article.url,
      contentHash
    );

    if (dedupeResult.isDuplicate) {
      return { found: 1, added: 0, skipped: 1 };
    }

    await this.insertArticle({
      sourceId,
      title: article.title,
      content: article.content,
      url: article.url,
      author: article.author,
      publishedAt: article.publishedAt,
      imageUrl: article.imageUrl,
      category: article.category,
      contentHash,
    });

    return { found: 1, added: 1, skipped: 0 };
  }

  /**
   * Insert article into database
   */
  private async insertArticle(data: {
    sourceId: string;
    title: string;
    content: string;
    url: string;
    author?: string;
    publishedAt: Date;
    imageUrl?: string;
    category?: string;
    contentHash: string;
  }): Promise<string> {
    const id = uuidv4();

    await this.db.query(
      `
      INSERT INTO articles (
        id, source_id, title, original_content, url, author,
        published_at, category, image_url, content_hash, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      `,
      [
        id,
        data.sourceId,
        data.title,
        data.content,
        data.url,
        data.author,
        data.publishedAt,
        data.category || 'other',
        data.imageUrl,
        data.contentHash,
      ]
    );

    return id;
  }

  /**
   * Create ingestion log entry
   */
  private async createIngestionLog(sourceId: string, jobType: string): Promise<string> {
    const id = uuidv4();

    await this.db.query(
      `
      INSERT INTO ingestion_logs (id, source_id, job_type, status, created_at)
      VALUES ($1, $2, $3, 'pending', NOW())
      `,
      [id, sourceId, jobType]
    );

    return id;
  }

  /**
   * Update ingestion log entry
   */
  private async updateIngestionLog(
    logId: string,
    updates: {
      status?: string;
      started_at?: Date;
      completed_at?: Date;
      articles_found?: number;
      articles_added?: number;
      articles_skipped?: number;
      error_message?: string;
    }
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.started_at) {
      fields.push(`started_at = $${paramIndex++}`);
      values.push(updates.started_at);
    }
    if (updates.completed_at) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completed_at);
    }
    if (updates.articles_found !== undefined) {
      fields.push(`articles_found = $${paramIndex++}`);
      values.push(updates.articles_found);
    }
    if (updates.articles_added !== undefined) {
      fields.push(`articles_added = $${paramIndex++}`);
      values.push(updates.articles_added);
    }
    if (updates.articles_skipped !== undefined) {
      fields.push(`articles_skipped = $${paramIndex++}`);
      values.push(updates.articles_skipped);
    }
    if (updates.error_message) {
      fields.push(`error_message = $${paramIndex++}`);
      values.push(updates.error_message);
    }

    values.push(logId);

    await this.db.query(
      `UPDATE ingestion_logs SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }

  /**
   * Update source last_fetched_at timestamp
   */
  private async updateSourceLastFetched(sourceId: string): Promise<void> {
    await this.db.query(
      'UPDATE sources SET last_fetched_at = NOW() WHERE id = $1',
      [sourceId]
    );
  }

  /**
   * Set up event listeners for the worker
   */
  private setupEventListeners(): void {
    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Worker error:', err);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`Job ${jobId} stalled`);
    });
  }

  /**
   * Close the worker
   */
  async close(): Promise<void> {
    await this.worker.close();
  }

  /**
   * Get the worker instance
   */
  getWorker(): Worker<NewsIngestionJobData> {
    return this.worker;
  }
}
