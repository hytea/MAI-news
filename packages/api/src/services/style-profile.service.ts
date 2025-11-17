import { Pool } from 'pg';
import {
  StyleProfile,
  CreateStyleProfile,
  UpdateStyleProfile,
  NotFoundError,
  ValidationError,
} from '@news-curator/shared';

export class StyleProfileService {
  constructor(private db: Pool) {}

  /**
   * Get all style profiles for a user
   */
  async getUserStyleProfiles(userId: string): Promise<StyleProfile[]> {
    const query = `
      SELECT * FROM style_profiles
      WHERE user_id = $1
      ORDER BY is_default DESC, usage_count DESC, created_at DESC
    `;

    const result = await this.db.query(query, [userId]);

    return result.rows.map(row => this.mapRowToStyleProfile(row));
  }

  /**
   * Get a single style profile by ID
   */
  async getStyleProfileById(id: string, userId: string): Promise<StyleProfile> {
    const query = `
      SELECT * FROM style_profiles
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.db.query(query, [id, userId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Style profile not found');
    }

    return this.mapRowToStyleProfile(result.rows[0]);
  }

  /**
   * Get public style profiles (community templates)
   */
  async getPublicStyleProfiles(limit: number = 20): Promise<StyleProfile[]> {
    const query = `
      SELECT * FROM style_profiles
      WHERE is_public = TRUE
      ORDER BY usage_count DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);

    return result.rows.map(row => this.mapRowToStyleProfile(row));
  }

  /**
   * Create a new style profile
   */
  async createStyleProfile(
    userId: string,
    data: CreateStyleProfile
  ): Promise<StyleProfile> {
    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await this.db.query(
        'UPDATE style_profiles SET is_default = FALSE WHERE user_id = $1 AND is_default = TRUE',
        [userId]
      );
    }

    const query = `
      INSERT INTO style_profiles (
        user_id,
        name,
        description,
        predefined_style,
        custom_prompt,
        tone,
        length,
        technical_level,
        include_context,
        include_key_points,
        is_default,
        is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      userId,
      data.name,
      data.description,
      data.predefinedStyle,
      data.customPrompt,
      data.tone,
      data.length,
      data.technicalLevel,
      data.includeContext,
      data.includeKeyPoints,
      data.isDefault,
      data.isPublic,
    ]);

    return this.mapRowToStyleProfile(result.rows[0]);
  }

  /**
   * Update a style profile
   */
  async updateStyleProfile(
    id: string,
    userId: string,
    data: UpdateStyleProfile
  ): Promise<StyleProfile> {
    // Check if profile exists and belongs to user
    await this.getStyleProfileById(id, userId);

    // If setting as default, unset other defaults
    if (data.isDefault === true) {
      await this.db.query(
        'UPDATE style_profiles SET is_default = FALSE WHERE user_id = $1 AND is_default = TRUE AND id != $2',
        [userId, id]
      );
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCounter = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCounter}`);
      values.push(data.name);
      paramCounter++;
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramCounter}`);
      values.push(data.description);
      paramCounter++;
    }

    if (data.predefinedStyle !== undefined) {
      updates.push(`predefined_style = $${paramCounter}`);
      values.push(data.predefinedStyle);
      paramCounter++;
    }

    if (data.customPrompt !== undefined) {
      updates.push(`custom_prompt = $${paramCounter}`);
      values.push(data.customPrompt);
      paramCounter++;
    }

    if (data.tone !== undefined) {
      updates.push(`tone = $${paramCounter}`);
      values.push(data.tone);
      paramCounter++;
    }

    if (data.length !== undefined) {
      updates.push(`length = $${paramCounter}`);
      values.push(data.length);
      paramCounter++;
    }

    if (data.technicalLevel !== undefined) {
      updates.push(`technical_level = $${paramCounter}`);
      values.push(data.technicalLevel);
      paramCounter++;
    }

    if (data.includeContext !== undefined) {
      updates.push(`include_context = $${paramCounter}`);
      values.push(data.includeContext);
      paramCounter++;
    }

    if (data.includeKeyPoints !== undefined) {
      updates.push(`include_key_points = $${paramCounter}`);
      values.push(data.includeKeyPoints);
      paramCounter++;
    }

    if (data.isDefault !== undefined) {
      updates.push(`is_default = $${paramCounter}`);
      values.push(data.isDefault);
      paramCounter++;
    }

    if (data.isPublic !== undefined) {
      updates.push(`is_public = $${paramCounter}`);
      values.push(data.isPublic);
      paramCounter++;
    }

    if (updates.length === 0) {
      // No updates, return existing profile
      return this.getStyleProfileById(id, userId);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE style_profiles
      SET ${updates.join(', ')}
      WHERE id = $${paramCounter} AND user_id = $${paramCounter + 1}
      RETURNING *
    `;

    values.push(id, userId);

    const result = await this.db.query(query, values);

    return this.mapRowToStyleProfile(result.rows[0]);
  }

  /**
   * Delete a style profile
   */
  async deleteStyleProfile(id: string, userId: string): Promise<void> {
    // Check if profile exists and belongs to user
    await this.getStyleProfileById(id, userId);

    // Don't allow deleting default profile if it's the only one
    const countQuery = `
      SELECT COUNT(*) as count FROM style_profiles WHERE user_id = $1
    `;
    const countResult = await this.db.query(countQuery, [userId]);
    const count = parseInt(countResult.rows[0].count, 10);

    const profileToDelete = await this.getStyleProfileById(id, userId);

    if (count === 1) {
      throw new ValidationError('Cannot delete the last style profile');
    }

    if (profileToDelete.isDefault && count > 1) {
      // Set another profile as default
      await this.db.query(
        `UPDATE style_profiles
         SET is_default = TRUE
         WHERE user_id = $1 AND id != $2
         ORDER BY usage_count DESC
         LIMIT 1`,
        [userId, id]
      );
    }

    const query = `
      DELETE FROM style_profiles
      WHERE id = $1 AND user_id = $2
    `;

    await this.db.query(query, [id, userId]);
  }

  /**
   * Get user's default style profile
   */
  async getUserDefaultStyleProfile(userId: string): Promise<StyleProfile | null> {
    const query = `
      SELECT * FROM style_profiles
      WHERE user_id = $1 AND is_default = TRUE
      LIMIT 1
    `;

    const result = await this.db.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToStyleProfile(result.rows[0]);
  }

  /**
   * Helper to map database row to StyleProfile
   */
  private mapRowToStyleProfile(row: any): StyleProfile {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      predefinedStyle: row.predefined_style,
      customPrompt: row.custom_prompt,
      tone: row.tone,
      length: row.length,
      technicalLevel: row.technical_level,
      includeContext: row.include_context,
      includeKeyPoints: row.include_key_points,
      isDefault: row.is_default,
      isPublic: row.is_public,
      usageCount: row.usage_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
