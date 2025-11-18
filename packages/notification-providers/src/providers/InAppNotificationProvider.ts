import { BaseNotificationProvider } from '../base/BaseNotificationProvider';
import {
  NotificationPayload,
  NotificationResult,
  NotificationChannel,
  ProviderConfig,
  NotificationStatus,
} from '../types';

/**
 * In-app notification provider (database-backed)
 * Stores notifications in the database for display in the app
 * Always free - uses existing database infrastructure
 */
export class InAppNotificationProvider extends BaseNotificationProvider {
  private dbClient: any; // Will be injected

  constructor(config: ProviderConfig, dbClient?: any) {
    super(config, NotificationChannel.IN_APP);
    this.dbClient = dbClient;
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
        error: 'In-app notification provider is disabled',
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
      // Insert notification into database
      const result = await this.dbClient.query(
        `INSERT INTO notifications
         (user_id, type, priority, title, body, data, action_url, image_url, expires_at, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         RETURNING id`,
        [
          payload.userId,
          payload.type,
          payload.priority,
          payload.title,
          payload.body,
          payload.data ? JSON.stringify(payload.data) : null,
          payload.actionUrl || null,
          payload.imageUrl || null,
          payload.expiresAt || null,
          NotificationStatus.SENT,
        ]
      );

      const notificationId = result.rows[0].id;

      return {
        success: true,
        notificationId: notificationId.toString(),
        channel: this.channel,
        metadata: {
          provider: 'in-app',
          stored: true,
        },
      };
    } catch (error) {
      console.error('In-app notification error:', error);
      return {
        success: false,
        channel: this.channel,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    if (!this.dbClient) {
      return false;
    }

    try {
      await this.dbClient.query(
        `UPDATE notifications
         SET status = $1, read_at = NOW()
         WHERE id = $2`,
        [NotificationStatus.READ, notificationId]
      );
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<boolean> {
    if (!this.dbClient) {
      return false;
    }

    try {
      await this.dbClient.query(
        `UPDATE notifications
         SET status = $1, read_at = NOW()
         WHERE user_id = $2 AND status != $1`,
        [NotificationStatus.READ, userId]
      );
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: number): Promise<boolean> {
    if (!this.dbClient) {
      return false;
    }

    try {
      await this.dbClient.query(
        `DELETE FROM notifications
         WHERE id = $1 AND user_id = $2`,
        [notificationId, userId]
      );
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: number): Promise<number> {
    if (!this.dbClient) {
      return 0;
    }

    try {
      const result = await this.dbClient.query(
        `SELECT COUNT(*) as count
         FROM notifications
         WHERE user_id = $1 AND status != $2`,
        [userId, NotificationStatus.READ]
      );
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: number,
    limit: number = 50,
    offset: number = 0,
    unreadOnly: boolean = false
  ): Promise<any[]> {
    if (!this.dbClient) {
      return [];
    }

    try {
      let query = `
        SELECT id, type, priority, title, body, data, action_url, image_url,
               status, created_at, read_at, expires_at
        FROM notifications
        WHERE user_id = $1
      `;

      const params: any[] = [userId];

      if (unreadOnly) {
        query += ` AND status != $${params.length + 1}`;
        params.push(NotificationStatus.READ);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await this.dbClient.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpired(): Promise<number> {
    if (!this.dbClient) {
      return 0;
    }

    try {
      const result = await this.dbClient.query(
        `DELETE FROM notifications
         WHERE expires_at IS NOT NULL AND expires_at < NOW()`
      );
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning up expired notifications:', error);
      return 0;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.dbClient) {
      return false;
    }

    try {
      await this.dbClient.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  getMetadata() {
    return {
      name: 'In-App Notifications',
      channel: NotificationChannel.IN_APP,
      description: 'Database-backed notifications displayed in the app (always free)',
    };
  }
}
