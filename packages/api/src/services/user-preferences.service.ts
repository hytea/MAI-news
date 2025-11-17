import { Pool } from 'pg';
import {
  UserPreferences,
  UpdateUserPreferences,
  NotFoundError,
} from '@news-curator/shared';

export class UserPreferencesService {
  constructor(private db: Pool) {}

  /**
   * Get user preferences
   * Creates default preferences if they don't exist
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const query = `
      SELECT * FROM user_preferences
      WHERE user_id = $1
    `;

    const result = await this.db.query(query, [userId]);

    if (result.rows.length === 0) {
      // Create default preferences
      return this.createDefaultPreferences(userId);
    }

    return this.mapRowToUserPreferences(result.rows[0]);
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string,
    data: UpdateUserPreferences
  ): Promise<UserPreferences> {
    // Ensure preferences exist
    await this.getUserPreferences(userId);

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCounter = 1;

    if (data.followedCategories !== undefined) {
      updates.push(`followed_categories = $${paramCounter}`);
      values.push(data.followedCategories);
      paramCounter++;
    }

    if (data.mutedCategories !== undefined) {
      updates.push(`muted_categories = $${paramCounter}`);
      values.push(data.mutedCategories);
      paramCounter++;
    }

    if (data.followedSources !== undefined) {
      updates.push(`followed_sources = $${paramCounter}`);
      values.push(data.followedSources);
      paramCounter++;
    }

    if (data.mutedSources !== undefined) {
      updates.push(`muted_sources = $${paramCounter}`);
      values.push(data.mutedSources);
      paramCounter++;
    }

    if (data.defaultStyleProfileId !== undefined) {
      updates.push(`default_style_profile_id = $${paramCounter}`);
      values.push(data.defaultStyleProfileId);
      paramCounter++;
    }

    if (data.notificationsEnabled !== undefined) {
      updates.push(`notifications_enabled = $${paramCounter}`);
      values.push(data.notificationsEnabled);
      paramCounter++;
    }

    if (data.emailDigestEnabled !== undefined) {
      updates.push(`email_digest_enabled = $${paramCounter}`);
      values.push(data.emailDigestEnabled);
      paramCounter++;
    }

    if (data.emailDigestTime !== undefined) {
      updates.push(`email_digest_time = $${paramCounter}`);
      values.push(data.emailDigestTime);
      paramCounter++;
    }

    if (data.breakingNewsAlerts !== undefined) {
      updates.push(`breaking_news_alerts = $${paramCounter}`);
      values.push(data.breakingNewsAlerts);
      paramCounter++;
    }

    if (data.preferredReadingTime !== undefined) {
      updates.push(`preferred_reading_time = $${paramCounter}`);
      values.push(data.preferredReadingTime);
      paramCounter++;
    }

    if (data.articlesPerSession !== undefined) {
      updates.push(`articles_per_session = $${paramCounter}`);
      values.push(data.articlesPerSession);
      paramCounter++;
    }

    if (updates.length === 0) {
      // No updates, return existing preferences
      return this.getUserPreferences(userId);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE user_preferences
      SET ${updates.join(', ')}
      WHERE user_id = $${paramCounter}
      RETURNING *
    `;

    values.push(userId);

    const result = await this.db.query(query, values);

    return this.mapRowToUserPreferences(result.rows[0]);
  }

  /**
   * Create default preferences for a new user
   */
  private async createDefaultPreferences(userId: string): Promise<UserPreferences> {
    const query = `
      INSERT INTO user_preferences (user_id)
      VALUES ($1)
      RETURNING *
    `;

    const result = await this.db.query(query, [userId]);

    return this.mapRowToUserPreferences(result.rows[0]);
  }

  /**
   * Helper to map database row to UserPreferences
   */
  private mapRowToUserPreferences(row: any): UserPreferences {
    return {
      id: row.id,
      userId: row.user_id,
      followedCategories: row.followed_categories || [],
      mutedCategories: row.muted_categories || [],
      followedSources: row.followed_sources || [],
      mutedSources: row.muted_sources || [],
      defaultStyleProfileId: row.default_style_profile_id,
      notificationsEnabled: row.notifications_enabled,
      emailDigestEnabled: row.email_digest_enabled,
      emailDigestTime: row.email_digest_time,
      breakingNewsAlerts: row.breaking_news_alerts,
      preferredReadingTime: row.preferred_reading_time,
      articlesPerSession: row.articles_per_session,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
