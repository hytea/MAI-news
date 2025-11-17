import { Pool } from 'pg';
import {
  ReadingHistory,
  CreateReadingHistory,
  SavedArticle,
  CreateSavedArticle,
  NotFoundError,
  ValidationError,
} from '@news-curator/shared';

export interface ReadingHistoryFilters {
  completed?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface ReadingHistoryPagination {
  limit: number;
  offset: number;
}

export class ReadingHistoryService {
  constructor(private db: Pool) {}

  /**
   * Get reading history for a user
   */
  async getUserReadingHistory(
    userId: string,
    filters: ReadingHistoryFilters,
    pagination: ReadingHistoryPagination
  ): Promise<{ history: ReadingHistory[]; total: number }> {
    const { completed, startDate, endDate } = filters;
    const { limit = 20, offset = 0 } = pagination;

    // Build WHERE clauses
    const whereClauses: string[] = ['user_id = $1'];
    const queryParams: any[] = [userId];
    let paramCounter = 2;

    if (completed !== undefined) {
      whereClauses.push(`completed = $${paramCounter}`);
      queryParams.push(completed);
      paramCounter++;
    }

    if (startDate) {
      whereClauses.push(`created_at >= $${paramCounter}`);
      queryParams.push(startDate);
      paramCounter++;
    }

    if (endDate) {
      whereClauses.push(`created_at <= $${paramCounter}`);
      queryParams.push(endDate);
      paramCounter++;
    }

    const whereClause = whereClauses.join(' AND ');

    // Build the main query
    const query = `
      SELECT * FROM reading_history
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `;

    queryParams.push(limit, offset);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM reading_history
      WHERE ${whereClause}
    `;

    const [historyResult, countResult] = await Promise.all([
      this.db.query(query, queryParams),
      this.db.query(countQuery, queryParams.slice(0, -2)), // Exclude limit and offset
    ]);

    const history: ReadingHistory[] = historyResult.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      articleId: row.article_id,
      rewrittenArticleId: row.rewritten_article_id,
      readingTimeSeconds: row.reading_time_seconds,
      completed: row.completed,
      createdAt: new Date(row.created_at),
    }));

    return {
      history,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  /**
   * Record an article being read
   */
  async recordReading(
    userId: string,
    data: CreateReadingHistory
  ): Promise<ReadingHistory> {
    // Check if this article was already read recently (within the last hour)
    const checkQuery = `
      SELECT * FROM reading_history
      WHERE user_id = $1 AND article_id = $2
        AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const existingResult = await this.db.query(checkQuery, [userId, data.articleId]);

    if (existingResult.rows.length > 0) {
      // Update the existing record instead of creating a new one
      const existingId = existingResult.rows[0].id;
      const updateQuery = `
        UPDATE reading_history
        SET
          rewritten_article_id = COALESCE($1, rewritten_article_id),
          reading_time_seconds = COALESCE($2, reading_time_seconds),
          completed = COALESCE($3, completed)
        WHERE id = $4
        RETURNING *
      `;

      const updateResult = await this.db.query(updateQuery, [
        data.rewrittenArticleId,
        data.readingTimeSeconds,
        data.completed,
        existingId,
      ]);

      const row = updateResult.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        articleId: row.article_id,
        rewrittenArticleId: row.rewritten_article_id,
        readingTimeSeconds: row.reading_time_seconds,
        completed: row.completed,
        createdAt: new Date(row.created_at),
      };
    }

    // Create new reading history record
    const insertQuery = `
      INSERT INTO reading_history (
        user_id,
        article_id,
        rewritten_article_id,
        reading_time_seconds,
        completed
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await this.db.query(insertQuery, [
      userId,
      data.articleId,
      data.rewrittenArticleId,
      data.readingTimeSeconds,
      data.completed,
    ]);

    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      articleId: row.article_id,
      rewrittenArticleId: row.rewritten_article_id,
      readingTimeSeconds: row.reading_time_seconds,
      completed: row.completed,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Get saved articles for a user
   */
  async getSavedArticles(
    userId: string,
    pagination: ReadingHistoryPagination
  ): Promise<{ savedArticles: SavedArticle[]; total: number }> {
    const { limit = 20, offset = 0 } = pagination;

    const query = `
      SELECT * FROM saved_articles
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM saved_articles
      WHERE user_id = $1
    `;

    const [savedResult, countResult] = await Promise.all([
      this.db.query(query, [userId, limit, offset]),
      this.db.query(countQuery, [userId]),
    ]);

    const savedArticles: SavedArticle[] = savedResult.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      articleId: row.article_id,
      notes: row.notes,
      createdAt: new Date(row.created_at),
    }));

    return {
      savedArticles,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  /**
   * Save an article
   */
  async saveArticle(
    userId: string,
    data: CreateSavedArticle
  ): Promise<SavedArticle> {
    try {
      const query = `
        INSERT INTO saved_articles (user_id, article_id, notes)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, article_id)
        DO UPDATE SET notes = EXCLUDED.notes
        RETURNING *
      `;

      const result = await this.db.query(query, [
        userId,
        data.articleId,
        data.notes,
      ]);

      const row = result.rows[0];

      return {
        id: row.id,
        userId: row.user_id,
        articleId: row.article_id,
        notes: row.notes,
        createdAt: new Date(row.created_at),
      };
    } catch (error: any) {
      if (error.code === '23503') {
        // Foreign key violation
        throw new NotFoundError('Article not found');
      }
      throw error;
    }
  }

  /**
   * Unsave an article
   */
  async unsaveArticle(userId: string, articleId: string): Promise<void> {
    const query = `
      DELETE FROM saved_articles
      WHERE user_id = $1 AND article_id = $2
    `;

    const result = await this.db.query(query, [userId, articleId]);

    if (result.rowCount === 0) {
      throw new NotFoundError('Saved article not found');
    }
  }

  /**
   * Get reading statistics for a user
   */
  async getReadingStats(userId: string): Promise<{
    totalArticlesRead: number;
    totalReadingTimeSeconds: number;
    articlesCompletedCount: number;
    averageReadingTimeSeconds: number;
    readingStreak: number;
  }> {
    const statsQuery = `
      SELECT
        COUNT(*) as total_articles_read,
        SUM(reading_time_seconds) as total_reading_time,
        COUNT(*) FILTER (WHERE completed = TRUE) as articles_completed,
        AVG(reading_time_seconds) as avg_reading_time
      FROM reading_history
      WHERE user_id = $1
    `;

    const statsResult = await this.db.query(statsQuery, [userId]);
    const stats = statsResult.rows[0];

    // Calculate reading streak (consecutive days with reading activity)
    const streakQuery = `
      WITH daily_reads AS (
        SELECT DISTINCT DATE(created_at) as read_date
        FROM reading_history
        WHERE user_id = $1
        ORDER BY read_date DESC
      ),
      streaks AS (
        SELECT
          read_date,
          read_date - ROW_NUMBER() OVER (ORDER BY read_date)::int AS streak_group
        FROM daily_reads
      )
      SELECT COUNT(*) as streak
      FROM streaks
      WHERE streak_group = (
        SELECT streak_group
        FROM streaks
        ORDER BY read_date DESC
        LIMIT 1
      )
    `;

    const streakResult = await this.db.query(streakQuery, [userId]);
    const streak = streakResult.rows.length > 0 ? parseInt(streakResult.rows[0].streak, 10) : 0;

    return {
      totalArticlesRead: parseInt(stats.total_articles_read, 10) || 0,
      totalReadingTimeSeconds: parseInt(stats.total_reading_time, 10) || 0,
      articlesCompletedCount: parseInt(stats.articles_completed, 10) || 0,
      averageReadingTimeSeconds: parseFloat(stats.avg_reading_time) || 0,
      readingStreak: streak,
    };
  }
}
