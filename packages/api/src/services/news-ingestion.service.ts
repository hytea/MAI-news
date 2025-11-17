import { Pool } from 'pg';
import { newsIngestionQueue, NewsIngestionJobData } from '../config/redis';

export interface Source {
  id: string;
  name: string;
  url: string;
  feedUrl?: string;
  scrapeEnabled: boolean;
  isActive: boolean;
  lastFetchedAt?: Date;
  fetchFrequencyMinutes: number;
}

export interface IngestionStats {
  totalJobs: number;
  pendingJobs: number;
  completedJobs: number;
  failedJobs: number;
}

export class NewsIngestionService {
  constructor(private db: Pool) {}

  /**
   * Trigger ingestion for a specific source
   */
  async triggerIngestion(sourceId: string): Promise<{ jobIds: string[] }> {
    const source = await this.getSource(sourceId);

    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }

    if (!source.isActive) {
      throw new Error(`Source ${sourceId} is not active`);
    }

    const jobIds: string[] = [];

    // Add RSS feed job if feed URL exists
    if (source.feedUrl) {
      const job = await newsIngestionQueue.add(
        `rss-${sourceId}`,
        {
          sourceId: source.id,
          jobType: 'rss',
          url: source.feedUrl,
        },
        {
          jobId: `rss-${sourceId}-${Date.now()}`,
        }
      );
      jobIds.push(job.id!);
    }

    // Add scrape job if scraping is enabled
    if (source.scrapeEnabled && source.url) {
      const job = await newsIngestionQueue.add(
        `scrape-${sourceId}`,
        {
          sourceId: source.id,
          jobType: 'scrape',
          url: source.url,
        },
        {
          jobId: `scrape-${sourceId}-${Date.now()}`,
        }
      );
      jobIds.push(job.id!);
    }

    if (jobIds.length === 0) {
      throw new Error('No ingestion methods configured for this source');
    }

    return { jobIds };
  }

  /**
   * Trigger ingestion for all active sources
   */
  async triggerAllSources(): Promise<{ totalJobs: number; jobIds: string[] }> {
    const sources = await this.getActiveSources();
    const allJobIds: string[] = [];

    for (const source of sources) {
      try {
        const { jobIds } = await this.triggerIngestion(source.id);
        allJobIds.push(...jobIds);
      } catch (error) {
        console.error(`Failed to trigger ingestion for source ${source.id}:`, error);
      }
    }

    return {
      totalJobs: allJobIds.length,
      jobIds: allJobIds,
    };
  }

  /**
   * Schedule periodic ingestion for sources based on fetch frequency
   */
  async schedulePeriodic(): Promise<{ totalScheduled: number }> {
    const sources = await this.getSourcesDueForFetch();
    let totalScheduled = 0;

    for (const source of sources) {
      try {
        // Add RSS job with delay based on source priority
        if (source.feedUrl) {
          await newsIngestionQueue.add(
            `rss-${source.id}`,
            {
              sourceId: source.id,
              jobType: 'rss',
              url: source.feedUrl,
            },
            {
              jobId: `rss-periodic-${source.id}-${Date.now()}`,
              delay: this.calculateDelay(totalScheduled),
            }
          );
          totalScheduled++;
        }

        // Add scrape job if enabled
        if (source.scrapeEnabled && source.url) {
          await newsIngestionQueue.add(
            `scrape-${source.id}`,
            {
              sourceId: source.id,
              jobType: 'scrape',
              url: source.url,
            },
            {
              jobId: `scrape-periodic-${source.id}-${Date.now()}`,
              delay: this.calculateDelay(totalScheduled),
            }
          );
          totalScheduled++;
        }
      } catch (error) {
        console.error(`Failed to schedule source ${source.id}:`, error);
      }
    }

    return { totalScheduled };
  }

  /**
   * Get ingestion statistics
   */
  async getIngestionStats(): Promise<IngestionStats> {
    const [waiting, active, completed, failed] = await Promise.all([
      newsIngestionQueue.getWaitingCount(),
      newsIngestionQueue.getActiveCount(),
      newsIngestionQueue.getCompletedCount(),
      newsIngestionQueue.getFailedCount(),
    ]);

    return {
      totalJobs: waiting + active + completed + failed,
      pendingJobs: waiting + active,
      completedJobs: completed,
      failedJobs: failed,
    };
  }

  /**
   * Get recent ingestion logs
   */
  async getIngestionLogs(limit: number = 50) {
    const result = await this.db.query(
      `
      SELECT
        il.*,
        s.name as source_name,
        s.url as source_url
      FROM ingestion_logs il
      LEFT JOIN sources s ON il.source_id = s.id
      ORDER BY il.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      jobType: row.job_type,
      status: row.status,
      articlesFound: row.articles_found,
      articlesAdded: row.articles_added,
      articlesSkipped: row.articles_skipped,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get a source by ID
   */
  private async getSource(sourceId: string): Promise<Source | null> {
    const result = await this.db.query(
      `
      SELECT
        id, name, url, feed_url, scrape_enabled, is_active,
        last_fetched_at, fetch_frequency_minutes
      FROM sources
      WHERE id = $1
      `,
      [sourceId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      feedUrl: row.feed_url,
      scrapeEnabled: row.scrape_enabled,
      isActive: row.is_active,
      lastFetchedAt: row.last_fetched_at,
      fetchFrequencyMinutes: row.fetch_frequency_minutes,
    };
  }

  /**
   * Get all active sources
   */
  private async getActiveSources(): Promise<Source[]> {
    const result = await this.db.query(
      `
      SELECT
        id, name, url, feed_url, scrape_enabled, is_active,
        last_fetched_at, fetch_frequency_minutes
      FROM sources
      WHERE is_active = true
      ORDER BY name
      `
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      feedUrl: row.feed_url,
      scrapeEnabled: row.scrape_enabled,
      isActive: row.is_active,
      lastFetchedAt: row.last_fetched_at,
      fetchFrequencyMinutes: row.fetch_frequency_minutes,
    }));
  }

  /**
   * Get sources that are due for fetching based on their frequency
   */
  private async getSourcesDueForFetch(): Promise<Source[]> {
    const result = await this.db.query(
      `
      SELECT
        id, name, url, feed_url, scrape_enabled, is_active,
        last_fetched_at, fetch_frequency_minutes
      FROM sources
      WHERE is_active = true
        AND (
          last_fetched_at IS NULL
          OR last_fetched_at < NOW() - (fetch_frequency_minutes || ' minutes')::INTERVAL
        )
      ORDER BY
        CASE WHEN last_fetched_at IS NULL THEN 0 ELSE 1 END,
        last_fetched_at ASC
      `
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      feedUrl: row.feed_url,
      scrapeEnabled: row.scrape_enabled,
      isActive: row.is_active,
      lastFetchedAt: row.last_fetched_at,
      fetchFrequencyMinutes: row.fetch_frequency_minutes,
    }));
  }

  /**
   * Calculate delay for job to avoid overwhelming sources
   * Staggers jobs by 1 second each
   */
  private calculateDelay(jobIndex: number): number {
    return jobIndex * 1000; // 1 second per job
  }

  /**
   * Pause ingestion queue
   */
  async pauseQueue(): Promise<void> {
    await newsIngestionQueue.pause();
  }

  /**
   * Resume ingestion queue
   */
  async resumeQueue(): Promise<void> {
    await newsIngestionQueue.resume();
  }

  /**
   * Clean old completed jobs
   */
  async cleanOldJobs(ageInDays: number = 7): Promise<void> {
    const ageInMs = ageInDays * 24 * 60 * 60 * 1000;
    await newsIngestionQueue.clean(ageInMs, 1000, 'completed');
    await newsIngestionQueue.clean(ageInMs, 1000, 'failed');
  }
}
