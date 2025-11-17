import { Pool } from 'pg';
import { NewsIngestionService } from './news-ingestion.service';

export class SchedulerService {
  private intervalId?: NodeJS.Timeout;
  private ingestionService: NewsIngestionService;

  constructor(private db: Pool, private intervalMinutes: number = 15) {
    this.ingestionService = new NewsIngestionService(db);
  }

  /**
   * Start the periodic scheduler
   */
  start(): void {
    if (this.intervalId) {
      console.warn('Scheduler is already running');
      return;
    }

    console.log(`Starting news ingestion scheduler (interval: ${this.intervalMinutes} minutes)`);

    // Run immediately on start
    this.runScheduledIngestion();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.runScheduledIngestion();
    }, this.intervalMinutes * 60 * 1000);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('Scheduler stopped');
    }
  }

  /**
   * Run scheduled ingestion for all due sources
   */
  private async runScheduledIngestion(): Promise<void> {
    try {
      console.log('Running scheduled ingestion...');
      const result = await this.ingestionService.schedulePeriodic();
      console.log(`Scheduled ${result.totalScheduled} ingestion jobs`);
    } catch (error) {
      console.error('Error running scheduled ingestion:', error);
    }
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return !!this.intervalId;
  }
}
