import { Pool } from 'pg';
import {
  BaseNotificationProvider,
  NotificationProviderFactory,
  NotificationChannel,
  NotificationPayload,
  NotificationResult,
  NotificationType,
  NotificationPriority,
  ProviderConfig,
  EmailNotificationPayload,
  PushNotificationPayload,
  InAppNotificationPayload,
} from '../../../notification-providers/src';

/**
 * Notification orchestration service
 * Coordinates sending notifications across multiple channels based on user preferences
 */
export class NotificationService {
  private providers: Map<NotificationChannel, BaseNotificationProvider>;
  private db: Pool;

  constructor(db: Pool, providerConfigs: Map<NotificationChannel, ProviderConfig>) {
    this.db = db;
    this.providers = NotificationProviderFactory.createProviders(providerConfigs, db);

    // Inject database client and user email retriever into providers
    this.injectDependencies();
  }

  /**
   * Inject dependencies into providers
   */
  private injectDependencies(): void {
    this.providers.forEach((provider) => {
      if ('setDbClient' in provider) {
        (provider as any).setDbClient(this.db);
      }
    });
  }

  /**
   * Send a notification to a user
   * Automatically routes to appropriate channels based on user preferences
   */
  async send(payload: NotificationPayload): Promise<NotificationResult[]> {
    try {
      // Get user notification preferences
      const preferences = await this.getUserPreferences(payload.userId);

      // Check if user wants this type of notification
      if (!this.shouldSendNotification(payload.type, preferences)) {
        return [{
          success: false,
          channel: NotificationChannel.IN_APP,
          error: 'User has disabled this notification type',
        }];
      }

      // Check quiet hours
      if (this.isQuietHours(preferences)) {
        // Queue for later or skip based on priority
        if (payload.priority !== NotificationPriority.URGENT) {
          return [{
            success: false,
            channel: NotificationChannel.IN_APP,
            error: 'Quiet hours active, notification not sent',
          }];
        }
      }

      // Determine which channels to use
      const channels = this.getChannelsForNotification(payload, preferences);

      // Send to all enabled channels
      const results: NotificationResult[] = [];

      for (const channel of channels) {
        const provider = this.providers.get(channel);

        if (!provider || !provider.isEnabled()) {
          continue;
        }

        try {
          // Enhance payload with user email if needed
          const enhancedPayload = await this.enhancePayload(payload, channel);
          const result = await provider.send(enhancedPayload);

          results.push(result);

          // Log the notification
          await this.logNotification(payload.userId, channel, payload.type, result);
        } catch (error) {
          console.error(`Error sending notification via ${channel}:`, error);
          results.push({
            success: false,
            channel,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error in notification service:', error);
      return [{
        success: false,
        channel: NotificationChannel.IN_APP,
        error: error instanceof Error ? error.message : 'Unknown error',
      }];
    }
  }

  /**
   * Send breaking news notification
   */
  async sendBreakingNews(
    userId: number,
    articleId: number,
    articleTitle: string,
    summary: string,
    url: string
  ): Promise<NotificationResult[]> {
    const payload: NotificationPayload = {
      userId,
      type: NotificationType.BREAKING_NEWS,
      priority: NotificationPriority.HIGH,
      title: `Breaking News: ${articleTitle}`,
      body: summary,
      actionUrl: url,
      data: { articleId },
    };

    return this.send(payload);
  }

  /**
   * Send daily digest notification
   */
  async sendDailyDigest(
    userId: number,
    articles: Array<{ id: number; title: string; summary: string; url: string }>
  ): Promise<NotificationResult[]> {
    const articleList = articles
      .map((a, i) => `${i + 1}. ${a.title}\n   ${a.summary}\n   Read: ${a.url}`)
      .join('\n\n');

    const payload: NotificationPayload = {
      userId,
      type: NotificationType.DAILY_DIGEST,
      priority: NotificationPriority.MEDIUM,
      title: `Your Daily News Digest - ${new Date().toLocaleDateString()}`,
      body: `Here are today's top stories:\n\n${articleList}`,
      actionUrl: '/news-feed',
      data: { articles: articles.map(a => a.id) },
    };

    return this.send(payload);
  }

  /**
   * Send article recommendation
   */
  async sendArticleRecommendation(
    userId: number,
    articleId: number,
    articleTitle: string,
    summary: string,
    url: string,
    reason?: string
  ): Promise<NotificationResult[]> {
    const payload: NotificationPayload = {
      userId,
      type: NotificationType.ARTICLE_RECOMMENDATION,
      priority: NotificationPriority.LOW,
      title: `We think you'll enjoy: ${articleTitle}`,
      body: reason ? `${reason}\n\n${summary}` : summary,
      actionUrl: url,
      data: { articleId, reason },
    };

    return this.send(payload);
  }

  /**
   * Get user notification preferences
   */
  private async getUserPreferences(userId: number): Promise<any> {
    const result = await this.db.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default preferences
      await this.createDefaultPreferences(userId);
      return this.getUserPreferences(userId);
    }

    return result.rows[0];
  }

  /**
   * Create default notification preferences for a user
   */
  private async createDefaultPreferences(userId: number): Promise<void> {
    await this.db.query(
      `INSERT INTO notification_preferences (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
  }

  /**
   * Check if notification should be sent based on user preferences
   */
  private shouldSendNotification(type: NotificationType, preferences: any): boolean {
    switch (type) {
      case NotificationType.BREAKING_NEWS:
        return preferences.breaking_news_enabled;
      case NotificationType.DAILY_DIGEST:
        return preferences.daily_digest_enabled;
      case NotificationType.ARTICLE_RECOMMENDATION:
        return preferences.article_recommendations_enabled;
      case NotificationType.READING_STREAK:
        return preferences.reading_streak_enabled;
      case NotificationType.COMMENT_REPLY:
        return preferences.comment_replies_enabled;
      default:
        return true; // System alerts always go through
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(preferences: any): boolean {
    if (!preferences.quiet_hours_start || !preferences.quiet_hours_end) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = preferences.quiet_hours_start.split(':').map(Number);
    const [endHour, endMin] = preferences.quiet_hours_end.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime < endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Get channels to use for this notification
   */
  private getChannelsForNotification(
    payload: NotificationPayload,
    preferences: any
  ): NotificationChannel[] {
    const channels: NotificationChannel[] = [];

    // In-app is always included if enabled
    if (preferences.in_app_enabled) {
      channels.push(NotificationChannel.IN_APP);
    }

    // Add other channels based on preferences and notification priority
    if (preferences.email_enabled && preferences.preferred_channels?.includes('email')) {
      // Only send email for important notifications
      if (
        payload.priority === NotificationPriority.HIGH ||
        payload.priority === NotificationPriority.URGENT ||
        payload.type === NotificationType.DAILY_DIGEST
      ) {
        channels.push(NotificationChannel.EMAIL);
      }
    }

    if (preferences.push_enabled && preferences.preferred_channels?.includes('push')) {
      // Push for urgent and breaking news
      if (
        payload.priority === NotificationPriority.URGENT ||
        payload.type === NotificationType.BREAKING_NEWS
      ) {
        channels.push(NotificationChannel.PUSH);
      }
    }

    return channels;
  }

  /**
   * Enhance payload with channel-specific data
   */
  private async enhancePayload(
    payload: NotificationPayload,
    channel: NotificationChannel
  ): Promise<NotificationPayload> {
    switch (channel) {
      case NotificationChannel.EMAIL:
        const user = await this.getUserEmail(payload.userId);
        return {
          ...payload,
          channel: NotificationChannel.EMAIL,
          subject: payload.title,
        } as EmailNotificationPayload;

      case NotificationChannel.PUSH:
        return {
          ...payload,
          channel: NotificationChannel.PUSH,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
        } as PushNotificationPayload;

      case NotificationChannel.IN_APP:
        return {
          ...payload,
          channel: NotificationChannel.IN_APP,
        } as InAppNotificationPayload;

      default:
        return payload;
    }
  }

  /**
   * Get user email from database
   */
  private async getUserEmail(userId: number): Promise<string> {
    const result = await this.db.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0].email;
  }

  /**
   * Log notification send attempt
   */
  private async logNotification(
    userId: number,
    channel: NotificationChannel,
    type: NotificationType,
    result: NotificationResult
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO notification_logs
         (user_id, channel, type, status, external_id, error_message, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          channel,
          type,
          result.success ? 'sent' : 'failed',
          result.externalId || null,
          result.error || null,
          result.metadata ? JSON.stringify(result.metadata) : null,
        ]
      );
    } catch (error) {
      console.error('Error logging notification:', error);
    }
  }

  /**
   * Get notification provider for a channel
   */
  getProvider(channel: NotificationChannel): BaseNotificationProvider | undefined {
    return this.providers.get(channel);
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<Map<NotificationChannel, boolean>> {
    const health = new Map<NotificationChannel, boolean>();

    for (const [channel, provider] of this.providers) {
      health.set(channel, await provider.healthCheck());
    }

    return health;
  }
}
