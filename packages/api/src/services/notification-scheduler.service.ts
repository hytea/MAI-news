import { Pool } from 'pg';
import { NotificationWorker } from '../workers/notification.worker';

/**
 * Scheduler service for automated notification triggers
 */
export class NotificationSchedulerService {
  private worker: NotificationWorker;
  private intervals: NodeJS.Timeout[] = [];

  constructor(db: Pool) {
    this.worker = new NotificationWorker(db);
  }

  /**
   * Start all scheduled tasks
   */
  start(): void {
    console.log('[NotificationScheduler] Starting notification scheduler...');

    // Check for breaking news every 15 minutes
    this.intervals.push(
      setInterval(
        () => this.worker.processBreakingNews(),
        15 * 60 * 1000 // 15 minutes
      )
    );

    // Process daily digests every hour
    this.intervals.push(
      setInterval(
        () => this.worker.processDailyDigest(),
        60 * 60 * 1000 // 1 hour
      )
    );

    // Process article recommendations every 6 hours
    this.intervals.push(
      setInterval(
        () => this.worker.processArticleRecommendations(),
        6 * 60 * 60 * 1000 // 6 hours
      )
    );

    // Clean up expired notifications daily
    this.intervals.push(
      setInterval(
        () => this.worker.cleanupExpiredNotifications(),
        24 * 60 * 60 * 1000 // 24 hours
      )
    );

    // Run initial checks immediately
    this.runInitialChecks();

    console.log('[NotificationScheduler] Scheduler started successfully');
  }

  /**
   * Run initial checks on startup
   */
  private async runInitialChecks(): Promise<void> {
    console.log('[NotificationScheduler] Running initial checks...');

    try {
      await this.worker.processBreakingNews();
      await this.worker.processDailyDigest();
    } catch (error) {
      console.error('[NotificationScheduler] Error in initial checks:', error);
    }
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    console.log('[NotificationScheduler] Stopping notification scheduler...');

    for (const interval of this.intervals) {
      clearInterval(interval);
    }

    this.intervals = [];

    console.log('[NotificationScheduler] Scheduler stopped');
  }

  /**
   * Manually trigger breaking news check
   */
  async triggerBreakingNews(): Promise<void> {
    await this.worker.processBreakingNews();
  }

  /**
   * Manually trigger daily digest
   */
  async triggerDailyDigest(): Promise<void> {
    await this.worker.processDailyDigest();
  }

  /**
   * Manually trigger recommendations
   */
  async triggerRecommendations(): Promise<void> {
    await this.worker.processArticleRecommendations();
  }

  /**
   * Manually trigger cleanup
   */
  async triggerCleanup(): Promise<void> {
    await this.worker.cleanupExpiredNotifications();
  }
}
