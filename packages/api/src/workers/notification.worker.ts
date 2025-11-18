import { Pool } from 'pg';
import { NotificationService } from '../services/notification.service';
import { NotificationPreferencesService } from '../services/notification-preferences.service';
import { NotificationChannel, ProviderConfig, NotificationPriority } from '../../../notification-providers/src';

/**
 * Notification worker for processing automated notifications
 * - Breaking news detection
 * - Daily digest generation
 * - Article recommendations
 */
export class NotificationWorker {
  private notificationService: NotificationService;
  private preferencesService: NotificationPreferencesService;
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;

    // Initialize services
    const providerConfigs = new Map<NotificationChannel, ProviderConfig>([
      [
        NotificationChannel.EMAIL,
        {
          enabled: !!process.env.RESEND_API_KEY,
          apiKey: process.env.RESEND_API_KEY,
          sender: process.env.EMAIL_FROM || 'NewsCurator AI <noreply@newscurator.ai>',
        },
      ],
      [
        NotificationChannel.IN_APP,
        {
          enabled: true,
        },
      ],
      [
        NotificationChannel.PUSH,
        {
          enabled: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
          options: {
            vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
            vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
            vapidSubject: process.env.VAPID_SUBJECT || 'mailto:noreply@newscurator.ai',
          },
        },
      ],
    ]);

    this.notificationService = new NotificationService(db, providerConfigs);
    this.preferencesService = new NotificationPreferencesService(db);
  }

  /**
   * Process breaking news notifications
   * Checks for high-importance articles published in the last hour
   */
  async processBreakingNews(): Promise<void> {
    try {
      console.log('[NotificationWorker] Processing breaking news...');

      // Find high-importance articles from the last hour that haven't been notified
      const articles = await this.db.query(
        `SELECT a.id, a.title, a.summary, a.url, a.category
         FROM articles a
         WHERE a.importance_score >= 8
         AND a.published_at >= NOW() - INTERVAL '1 hour'
         AND NOT EXISTS (
           SELECT 1 FROM notification_logs nl
           WHERE nl.user_id IS NOT NULL
           AND nl.type = 'breaking_news'
           AND nl.metadata->>'articleId' = a.id::text
         )
         LIMIT 10`
      );

      if (articles.rows.length === 0) {
        console.log('[NotificationWorker] No breaking news found');
        return;
      }

      console.log(`[NotificationWorker] Found ${articles.rows.length} breaking news articles`);

      // Get users who want breaking news notifications
      const users = await this.preferencesService.getUsersForBreakingNews();

      console.log(`[NotificationWorker] Sending to ${users.length} users`);

      // Send notifications to interested users
      for (const article of articles.rows) {
        for (const userId of users) {
          try {
            // Check if user follows this category
            const userPrefs = await this.getUserPreferences(userId);

            if (this.userInterestedInCategory(userPrefs, article.category)) {
              await this.notificationService.sendBreakingNews(
                userId,
                article.id,
                article.title,
                article.summary || `Read the latest breaking news in ${article.category}`,
                article.url || `/articles/${article.id}`
              );
            }
          } catch (error) {
            console.error(`Error sending breaking news to user ${userId}:`, error);
          }
        }
      }

      console.log('[NotificationWorker] Breaking news processing complete');
    } catch (error) {
      console.error('[NotificationWorker] Error processing breaking news:', error);
    }
  }

  /**
   * Process daily digest notifications
   * Sends digest at user's preferred time
   */
  async processDailyDigest(): Promise<void> {
    try {
      console.log('[NotificationWorker] Processing daily digests...');

      // Get current hour in HH:00:00 format
      const now = new Date();
      const currentHour = `${String(now.getHours()).padStart(2, '0')}:00:00`;

      // Get users who want digest at this time
      const users = await this.preferencesService.getUsersForDailyDigest(currentHour);

      if (users.length === 0) {
        console.log(`[NotificationWorker] No users scheduled for digest at ${currentHour}`);
        return;
      }

      console.log(`[NotificationWorker] Sending daily digest to ${users.length} users`);

      // Generate and send digest for each user
      for (const userId of users) {
        try {
          await this.sendUserDailyDigest(userId);
        } catch (error) {
          console.error(`Error sending daily digest to user ${userId}:`, error);
        }
      }

      console.log('[NotificationWorker] Daily digest processing complete');
    } catch (error) {
      console.error('[NotificationWorker] Error processing daily digests:', error);
    }
  }

  /**
   * Send daily digest to a specific user
   */
  private async sendUserDailyDigest(userId: number): Promise<void> {
    // Get user preferences to determine interests
    const userPrefs = await this.getUserPreferences(userId);

    // Get top articles from last 24 hours based on user's interests
    const articles = await this.db.query(
      `SELECT id, title, summary, url, category, importance_score
       FROM articles
       WHERE published_at >= NOW() - INTERVAL '24 hours'
       AND (
         $1::text[] IS NULL
         OR category = ANY($1::text[])
       )
       ORDER BY importance_score DESC, published_at DESC
       LIMIT 10`,
      [userPrefs?.followed_categories || null]
    );

    if (articles.rows.length === 0) {
      console.log(`No articles for user ${userId}'s daily digest`);
      return;
    }

    // Format articles for digest
    const digestArticles = articles.rows.map(a => ({
      id: a.id,
      title: a.title,
      summary: a.summary || 'No summary available',
      url: a.url || `/articles/${a.id}`,
    }));

    // Send digest notification
    await this.notificationService.sendDailyDigest(userId, digestArticles);
  }

  /**
   * Process article recommendations
   * Uses reading history to recommend similar articles
   */
  async processArticleRecommendations(): Promise<void> {
    try {
      console.log('[NotificationWorker] Processing article recommendations...');

      // Get users who want recommendations
      const users = await this.db.query(
        `SELECT DISTINCT user_id
         FROM notification_preferences
         WHERE article_recommendations_enabled = true
         LIMIT 100`
      );

      console.log(`[NotificationWorker] Processing recommendations for ${users.rows.length} users`);

      for (const { user_id } of users.rows) {
        try {
          await this.sendUserRecommendations(user_id);
        } catch (error) {
          console.error(`Error sending recommendations to user ${user_id}:`, error);
        }
      }

      console.log('[NotificationWorker] Article recommendations processing complete');
    } catch (error) {
      console.error('[NotificationWorker] Error processing recommendations:', error);
    }
  }

  /**
   * Send personalized recommendations to a user
   */
  private async sendUserRecommendations(userId: number): Promise<void> {
    // Get user's reading history
    const history = await this.db.query(
      `SELECT a.category, COUNT(*) as count
       FROM reading_history rh
       JOIN articles a ON a.id = rh.article_id
       WHERE rh.user_id = $1
       AND rh.read_at >= NOW() - INTERVAL '7 days'
       GROUP BY a.category
       ORDER BY count DESC
       LIMIT 3`,
      [userId]
    );

    if (history.rows.length === 0) {
      return; // No recent reading history
    }

    const topCategories = history.rows.map(r => r.category);

    // Find recent articles in user's top categories they haven't read
    const recommendations = await this.db.query(
      `SELECT a.id, a.title, a.summary, a.url, a.category
       FROM articles a
       WHERE a.category = ANY($1::text[])
       AND a.published_at >= NOW() - INTERVAL '48 hours'
       AND NOT EXISTS (
         SELECT 1 FROM reading_history rh
         WHERE rh.user_id = $2 AND rh.article_id = a.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM notification_logs nl
         WHERE nl.user_id = $2
         AND nl.type = 'article_recommendation'
         AND nl.metadata->>'articleId' = a.id::text
         AND nl.sent_at >= NOW() - INTERVAL '7 days'
       )
       ORDER BY a.importance_score DESC
       LIMIT 1`,
      [topCategories, userId]
    );

    if (recommendations.rows.length === 0) {
      return; // No new recommendations
    }

    const article = recommendations.rows[0];

    await this.notificationService.sendArticleRecommendation(
      userId,
      article.id,
      article.title,
      article.summary || 'Check out this article we think you\'ll enjoy',
      article.url || `/articles/${article.id}`,
      `Based on your interest in ${article.category}`
    );
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<void> {
    try {
      console.log('[NotificationWorker] Cleaning up expired notifications...');

      const inAppProvider = this.notificationService.getProvider(NotificationChannel.IN_APP);

      if (inAppProvider && 'cleanupExpired' in inAppProvider) {
        const count = await (inAppProvider as any).cleanupExpired();
        console.log(`[NotificationWorker] Cleaned up ${count} expired notifications`);
      }
    } catch (error) {
      console.error('[NotificationWorker] Error cleaning up notifications:', error);
    }
  }

  /**
   * Get user preferences from database
   */
  private async getUserPreferences(userId: number): Promise<any> {
    const result = await this.db.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Check if user is interested in a category
   */
  private userInterestedInCategory(userPrefs: any, category: string): boolean {
    if (!userPrefs) return true; // Default to interested

    const followed = userPrefs.followed_categories || [];
    const muted = userPrefs.muted_categories || [];

    if (muted.includes(category)) return false;
    if (followed.length === 0) return true; // No specific preferences
    return followed.includes(category);
  }
}
