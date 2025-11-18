import {
  NotificationPayload,
  NotificationResult,
  NotificationChannel,
  ProviderConfig,
  BatchNotificationRequest,
} from '../types';

/**
 * Abstract base class for all notification providers
 * Follows the same pattern as AI providers for consistency
 */
export abstract class BaseNotificationProvider {
  protected config: ProviderConfig;
  protected channel: NotificationChannel;

  constructor(config: ProviderConfig, channel: NotificationChannel) {
    this.config = config;
    this.channel = channel;
  }

  /**
   * Send a single notification
   */
  abstract send(payload: NotificationPayload): Promise<NotificationResult>;

  /**
   * Send multiple notifications in batch
   */
  async sendBatch(request: BatchNotificationRequest): Promise<NotificationResult[]> {
    // Default implementation: send one by one
    // Providers can override for optimized batch sending
    const results: NotificationResult[] = [];

    for (const notification of request.notifications) {
      try {
        const result = await this.send(notification);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          channel: this.channel,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Validate notification payload
   */
  protected validatePayload(payload: NotificationPayload): void {
    if (!payload.userId) {
      throw new Error('userId is required');
    }
    if (!payload.type) {
      throw new Error('Notification type is required');
    }
    if (!payload.title) {
      throw new Error('Notification title is required');
    }
    if (!payload.body) {
      throw new Error('Notification body is required');
    }
  }

  /**
   * Check if provider is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get provider channel
   */
  getChannel(): NotificationChannel {
    return this.channel;
  }

  /**
   * Health check for provider
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get provider metadata
   */
  abstract getMetadata(): {
    name: string;
    channel: NotificationChannel;
    description: string;
    rateLimit?: {
      maxPerMinute: number;
      maxPerDay: number;
    };
  };
}
