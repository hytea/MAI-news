import { BaseNotificationProvider } from '../base/BaseNotificationProvider';
import {
  NotificationPayload,
  NotificationResult,
  NotificationChannel,
  ProviderConfig,
  PushNotificationPayload,
} from '../types';
import * as webpush from 'web-push';

/**
 * Web Push notification provider using native Web Push API
 * Free - uses browser native push notification system
 * Requires VAPID keys for authentication
 */
export class WebPushProvider extends BaseNotificationProvider {
  private vapidPublicKey: string;
  private vapidPrivateKey: string;
  private vapidSubject: string;
  private dbClient: any; // For retrieving push subscriptions

  constructor(config: ProviderConfig, dbClient?: any) {
    super(config, NotificationChannel.PUSH);

    if (!config.options?.vapidPublicKey || !config.options?.vapidPrivateKey) {
      throw new Error('VAPID keys are required for Web Push');
    }

    this.vapidPublicKey = config.options.vapidPublicKey;
    this.vapidPrivateKey = config.options.vapidPrivateKey;
    this.vapidSubject = config.options.vapidSubject || 'mailto:noreply@newscurator.ai';
    this.dbClient = dbClient;

    // Configure web-push
    webpush.setVapidDetails(
      this.vapidSubject,
      this.vapidPublicKey,
      this.vapidPrivateKey
    );
  }

  /**
   * Set database client for dependency injection
   */
  setDbClient(dbClient: any): void {
    this.dbClient = dbClient;
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    this.validatePayload(payload);

    if (!this.isEnabled()) {
      return {
        success: false,
        channel: this.channel,
        error: 'Push notification provider is disabled',
      };
    }

    if (!this.dbClient) {
      return {
        success: false,
        channel: this.channel,
        error: 'Database client not configured',
      };
    }

    try {
      // Get user's push subscriptions
      const subscriptions = await this.getUserSubscriptions(payload.userId);

      if (subscriptions.length === 0) {
        return {
          success: false,
          channel: this.channel,
          error: 'User has no active push subscriptions',
        };
      }

      const pushPayload = payload as PushNotificationPayload;

      // Prepare push notification data
      const notificationData = {
        title: payload.title,
        body: payload.body,
        icon: pushPayload.icon || '/icon-192x192.png',
        badge: pushPayload.badge || '/badge-72x72.png',
        image: payload.imageUrl,
        tag: pushPayload.tag || `notification-${Date.now()}`,
        data: {
          url: payload.actionUrl || '/',
          ...payload.data,
        },
        requireInteraction: pushPayload.requireInteraction || false,
        actions: payload.actionUrl ? [
          { action: 'open', title: 'View' },
          { action: 'close', title: 'Dismiss' },
        ] : undefined,
      };

      const results = [];
      let successCount = 0;

      // Send to all user's devices
      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            subscription.subscription_data,
            JSON.stringify(notificationData)
          );
          successCount++;
        } catch (error: any) {
          console.error('Failed to send push to subscription:', error);

          // If subscription is invalid (410 Gone), remove it
          if (error.statusCode === 410) {
            await this.removeSubscription(subscription.id);
          }

          results.push({
            subscriptionId: subscription.id,
            error: error.message,
          });
        }
      }

      return {
        success: successCount > 0,
        channel: this.channel,
        metadata: {
          provider: 'web-push',
          totalSubscriptions: subscriptions.length,
          successCount,
          failedSubscriptions: results.filter(r => r.error).length,
        },
      };
    } catch (error) {
      console.error('Web push error:', error);
      return {
        success: false,
        channel: this.channel,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Subscribe a user to push notifications
   */
  async subscribe(userId: number, subscription: any): Promise<string | null> {
    if (!this.dbClient) {
      return null;
    }

    try {
      const result = await this.dbClient.query(
        `INSERT INTO push_subscriptions
         (user_id, subscription_data, endpoint, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (endpoint) DO UPDATE
         SET subscription_data = $2, updated_at = NOW()
         RETURNING id`,
        [userId, subscription, subscription.endpoint]
      );

      return result.rows[0].id.toString();
    } catch (error) {
      console.error('Error saving push subscription:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(userId: number, endpoint: string): Promise<boolean> {
    if (!this.dbClient) {
      return false;
    }

    try {
      await this.dbClient.query(
        `DELETE FROM push_subscriptions
         WHERE user_id = $1 AND endpoint = $2`,
        [userId, endpoint]
      );
      return true;
    } catch (error) {
      console.error('Error removing push subscription:', error);
      return false;
    }
  }

  /**
   * Get user's push subscriptions
   */
  private async getUserSubscriptions(userId: number): Promise<any[]> {
    if (!this.dbClient) {
      return [];
    }

    try {
      const result = await this.dbClient.query(
        `SELECT id, subscription_data, endpoint
         FROM push_subscriptions
         WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting push subscriptions:', error);
      return [];
    }
  }

  /**
   * Remove invalid subscription
   */
  private async removeSubscription(subscriptionId: number): Promise<void> {
    if (!this.dbClient) {
      return;
    }

    try {
      await this.dbClient.query(
        `DELETE FROM push_subscriptions WHERE id = $1`,
        [subscriptionId]
      );
    } catch (error) {
      console.error('Error removing subscription:', error);
    }
  }

  /**
   * Get VAPID public key for client-side subscription
   */
  getPublicKey(): string {
    return this.vapidPublicKey;
  }

  async healthCheck(): Promise<boolean> {
    // Check if VAPID keys are configured
    return !!this.vapidPublicKey && !!this.vapidPrivateKey && this.isEnabled();
  }

  getMetadata() {
    return {
      name: 'Web Push Notifications',
      channel: NotificationChannel.PUSH,
      description: 'Browser push notifications using native Web Push API (always free)',
      rateLimit: {
        maxPerMinute: 60,
        maxPerDay: 10000,
      },
    };
  }
}
