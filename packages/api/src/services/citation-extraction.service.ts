import { Pool } from 'pg';
import { Citation } from '@news-curator/shared';
import { v4 as uuidv4 } from 'uuid';

export interface ExtractedCitation {
  text: string;
  url?: string;
  position: number;
}

/**
 * Service for extracting and managing citations from rewritten articles
 */
export class CitationExtractionService {
  constructor(private db: Pool) {}

  /**
   * Extract citations from rewritten content
   * Looks for citation patterns like [1], [Source: URL], etc.
   */
  extractCitations(content: string): ExtractedCitation[] {
    const citations: ExtractedCitation[] = [];

    // Pattern 1: [Source: text](url) - Markdown-style citations
    const markdownPattern = /\[Source:\s*([^\]]+)\]\(([^)]+)\)/gi;
    let match;
    let position = 0;

    while ((match = markdownPattern.exec(content)) !== null) {
      citations.push({
        text: match[1].trim(),
        url: match[2].trim(),
        position: position++,
      });
    }

    // Pattern 2: [Citation: text - url] - Custom format
    const customPattern = /\[Citation:\s*([^\-]+)\s*-\s*([^\]]+)\]/gi;

    while ((match = customPattern.exec(content)) !== null) {
      citations.push({
        text: match[1].trim(),
        url: match[2].trim(),
        position: position++,
      });
    }

    // Pattern 3: (Source: text) - Simple parenthetical citations
    const parentheticalPattern = /\(Source:\s*([^)]+)\)/gi;

    while ((match = parentheticalPattern.exec(content)) !== null) {
      const sourceText = match[1].trim();
      // Check if it contains a URL
      const urlMatch = sourceText.match(/(https?:\/\/[^\s]+)/);

      citations.push({
        text: urlMatch ? sourceText.replace(urlMatch[0], '').trim() : sourceText,
        url: urlMatch ? urlMatch[0] : undefined,
        position: position++,
      });
    }

    return citations;
  }

  /**
   * Extract citations from AI response that may include structured citation data
   */
  extractCitationsFromAIResponse(
    content: string,
    aiCitations?: Array<{ text: string; url?: string; position: number }>
  ): ExtractedCitation[] {
    // If AI provided structured citations, use those
    if (aiCitations && aiCitations.length > 0) {
      return aiCitations;
    }

    // Otherwise, extract from content
    return this.extractCitations(content);
  }

  /**
   * Store citations in the database
   */
  async storeCitations(
    rewrittenArticleId: string,
    citations: ExtractedCitation[],
    sourceArticleId?: string
  ): Promise<Citation[]> {
    if (citations.length === 0) {
      return [];
    }

    const values = citations.map((citation) => [
      uuidv4(),
      rewrittenArticleId,
      sourceArticleId || null,
      citation.text,
      citation.url || null,
      citation.position,
      new Date(),
    ]);

    const query = `
      INSERT INTO citations (
        id,
        rewritten_article_id,
        source_article_id,
        text,
        url,
        position,
        created_at
      )
      VALUES ${values.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(', ')}
      RETURNING *
    `;

    const params = values.flat();
    const result = await this.db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      rewrittenArticleId: row.rewritten_article_id,
      sourceArticleId: row.source_article_id,
      text: row.text,
      url: row.url,
      position: row.position,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get citations for a rewritten article
   */
  async getCitationsForArticle(rewrittenArticleId: string): Promise<Citation[]> {
    const query = `
      SELECT
        id,
        rewritten_article_id,
        source_article_id,
        text,
        url,
        position,
        created_at
      FROM citations
      WHERE rewritten_article_id = $1
      ORDER BY position ASC
    `;

    const result = await this.db.query(query, [rewrittenArticleId]);

    return result.rows.map(row => ({
      id: row.id,
      rewrittenArticleId: row.rewritten_article_id,
      sourceArticleId: row.source_article_id,
      text: row.text,
      url: row.url,
      position: row.position,
      createdAt: row.created_at,
    }));
  }

  /**
   * Delete citations for a rewritten article
   */
  async deleteCitationsForArticle(rewrittenArticleId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM citations WHERE rewritten_article_id = $1',
      [rewrittenArticleId]
    );
  }

  /**
   * Add the original source article as a citation
   */
  async addSourceArticleCitation(
    rewrittenArticleId: string,
    sourceArticleId: string,
    sourceUrl: string,
    sourceName: string
  ): Promise<Citation> {
    const id = uuidv4();
    const query = `
      INSERT INTO citations (
        id,
        rewritten_article_id,
        source_article_id,
        text,
        url,
        position,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      id,
      rewrittenArticleId,
      sourceArticleId,
      `Original source: ${sourceName}`,
      sourceUrl,
      -1, // Position -1 for the original source citation
      new Date(),
    ]);

    const row = result.rows[0];
    return {
      id: row.id,
      rewrittenArticleId: row.rewritten_article_id,
      sourceArticleId: row.source_article_id,
      text: row.text,
      url: row.url,
      position: row.position,
      createdAt: row.created_at,
    };
  }
}
