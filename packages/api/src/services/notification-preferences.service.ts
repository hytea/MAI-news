import { Pool } from 'pg';
import { NotificationChannel } from '../../../notification-providers/src';

export interface NotificationPreferencesData {
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  breakingNewsEnabled?: boolean;
  dailyDigestEnabled?: boolean;
  dailyDigestTime?: string;
  articleRecommendationsEnabled?: boolean;
  readingStreakEnabled?: boolean;
  commentRepliesEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  preferredChannels?: NotificationChannel[];
}

/**
 * Service for managing user notification preferences
 */
export class NotificationPreferencesService {
  constructor(private db: Pool) {}

  /**
   * Get user's notification preferences
   */
  async getPreferences(userId: number): Promise<NotificationPreferencesData | null> {
    const result = await this.db.query(
      `SELECT
        email_enabled as "emailEnabled",
        push_enabled as "pushEnabled",
        in_app_enabled as "inAppEnabled",
        breaking_news_enabled as "breakingNewsEnabled",
        daily_digest_enabled as "dailyDigestEnabled",
        daily_digest_time as "dailyDigestTime",
        article_recommendations_enabled as "articleRecommendationsEnabled",
        reading_streak_enabled as "readingStreakEnabled",
        comment_replies_enabled as "commentRepliesEnabled",
        quiet_hours_start as "quietHoursStart",
        quiet_hours_end as "quietHoursEnd",
        preferred_channels as "preferredChannels"
      FROM notification_preferences
      WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const prefs = result.rows[0];

    // Format time fields if they exist
    if (prefs.dailyDigestTime) {
      prefs.dailyDigestTime = this.formatTime(prefs.dailyDigestTime);
    }
    if (prefs.quietHoursStart) {
      prefs.quietHoursStart = this.formatTime(prefs.quietHoursStart);
    }
    if (prefs.quietHoursEnd) {
      prefs.quietHoursEnd = this.formatTime(prefs.quietHoursEnd);
    }

    return prefs;
  }

  /**
   * Update user's notification preferences
   */
  async updatePreferences(
    userId: number,
    preferences: NotificationPreferencesData
  ): Promise<NotificationPreferencesData> {
    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [userId];
    let paramCount = 2;

    if (preferences.emailEnabled !== undefined) {
      updates.push(`email_enabled = $${paramCount++}`);
      values.push(preferences.emailEnabled);
    }

    if (preferences.pushEnabled !== undefined) {
      updates.push(`push_enabled = $${paramCount++}`);
      values.push(preferences.pushEnabled);
    }

    if (preferences.inAppEnabled !== undefined) {
      updates.push(`in_app_enabled = $${paramCount++}`);
      values.push(preferences.inAppEnabled);
    }

    if (preferences.breakingNewsEnabled !== undefined) {
      updates.push(`breaking_news_enabled = $${paramCount++}`);
      values.push(preferences.breakingNewsEnabled);
    }

    if (preferences.dailyDigestEnabled !== undefined) {
      updates.push(`daily_digest_enabled = $${paramCount++}`);
      values.push(preferences.dailyDigestEnabled);
    }

    if (preferences.dailyDigestTime !== undefined) {
      updates.push(`daily_digest_time = $${paramCount++}`);
      values.push(preferences.dailyDigestTime);
    }

    if (preferences.articleRecommendationsEnabled !== undefined) {
      updates.push(`article_recommendations_enabled = $${paramCount++}`);
      values.push(preferences.articleRecommendationsEnabled);
    }

    if (preferences.readingStreakEnabled !== undefined) {
      updates.push(`reading_streak_enabled = $${paramCount++}`);
      values.push(preferences.readingStreakEnabled);
    }

    if (preferences.commentRepliesEnabled !== undefined) {
      updates.push(`comment_replies_enabled = $${paramCount++}`);
      values.push(preferences.commentRepliesEnabled);
    }

    if (preferences.quietHoursStart !== undefined) {
      updates.push(`quiet_hours_start = $${paramCount++}`);
      values.push(preferences.quietHoursStart);
    }

    if (preferences.quietHoursEnd !== undefined) {
      updates.push(`quiet_hours_end = $${paramCount++}`);
      values.push(preferences.quietHoursEnd);
    }

    if (preferences.preferredChannels !== undefined) {
      updates.push(`preferred_channels = $${paramCount++}`);
      values.push(preferences.preferredChannels);
    }

    if (updates.length === 0) {
      // No updates, just return current preferences
      const current = await this.getPreferences(userId);
      if (current) return current;

      // Create default if doesn't exist
      await this.createDefaultPreferences(userId);
      return (await this.getPreferences(userId))!;
    }

    const query = `
      UPDATE notification_preferences
      SET ${updates.join(', ')}
      WHERE user_id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      // Preferences don't exist, create them
      await this.createDefaultPreferences(userId);
      return this.updatePreferences(userId, preferences);
    }

    return this.formatPreferences(result.rows[0]);
  }

  /**
   * Create default preferences for a user
   */
  async createDefaultPreferences(userId: number): Promise<NotificationPreferencesData> {
    const result = await this.db.query(
      `INSERT INTO notification_preferences (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING *`,
      [userId]
    );

    if (result.rows.length > 0) {
      return this.formatPreferences(result.rows[0]);
    }

    // If conflict, fetch existing
    return (await this.getPreferences(userId))!;
  }

  /**
   * Get all users who want daily digest at a specific time
   */
  async getUsersForDailyDigest(time: string): Promise<number[]> {
    const result = await this.db.query(
      `SELECT user_id
       FROM notification_preferences
       WHERE daily_digest_enabled = true
       AND daily_digest_time = $1
       AND email_enabled = true`,
      [time]
    );

    return result.rows.map(row => row.user_id);
  }

  /**
   * Get all users who want breaking news notifications
   */
  async getUsersForBreakingNews(): Promise<number[]> {
    const result = await this.db.query(
      `SELECT user_id
       FROM notification_preferences
       WHERE breaking_news_enabled = true
       AND (email_enabled = true OR push_enabled = true OR in_app_enabled = true)`
    );

    return result.rows.map(row => row.user_id);
  }

  /**
   * Format time from database format
   */
  private formatTime(time: any): string {
    if (typeof time === 'string') {
      // Already formatted
      return time;
    }

    // Handle PostgreSQL time object
    const hours = String(time.hours || 0).padStart(2, '0');
    const minutes = String(time.minutes || 0).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Format preferences object from database
   */
  private formatPreferences(row: any): NotificationPreferencesData {
    return {
      emailEnabled: row.email_enabled,
      pushEnabled: row.push_enabled,
      inAppEnabled: row.in_app_enabled,
      breakingNewsEnabled: row.breaking_news_enabled,
      dailyDigestEnabled: row.daily_digest_enabled,
      dailyDigestTime: row.daily_digest_time ? this.formatTime(row.daily_digest_time) : undefined,
      articleRecommendationsEnabled: row.article_recommendations_enabled,
      readingStreakEnabled: row.reading_streak_enabled,
      commentRepliesEnabled: row.comment_replies_enabled,
      quietHoursStart: row.quiet_hours_start ? this.formatTime(row.quiet_hours_start) : undefined,
      quietHoursEnd: row.quiet_hours_end ? this.formatTime(row.quiet_hours_end) : undefined,
      preferredChannels: row.preferred_channels || [],
    };
  }

  /**
   * Delete user preferences
   */
  async deletePreferences(userId: number): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM notification_preferences WHERE user_id = $1',
      [userId]
    );

    return (result.rowCount ?? 0) > 0;
  }
}
