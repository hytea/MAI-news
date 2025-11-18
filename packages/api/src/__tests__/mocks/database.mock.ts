import { Pool, QueryResult } from 'pg';

export class MockPool {
  private queryResults: Map<string, any> = new Map();

  query = jest.fn(async (text: string, params?: any[]): Promise<QueryResult> => {
    // Check if we have a specific mock result for this query
    const mockResult = this.queryResults.get(text);

    if (mockResult) {
      return mockResult;
    }

    // Default empty result
    return {
      rows: [],
      rowCount: 0,
      command: '',
      oid: 0,
      fields: [],
    };
  });

  connect = jest.fn(async () => ({
    query: this.query,
    release: jest.fn(),
  }));

  end = jest.fn(async () => {});

  on = jest.fn();

  // Helper method to set mock results
  setQueryResult(query: string, result: Partial<QueryResult>) {
    this.queryResults.set(query, {
      rows: result.rows || [],
      rowCount: result.rowCount || result.rows?.length || 0,
      command: result.command || 'SELECT',
      oid: 0,
      fields: result.fields || [],
    });
  }

  // Helper to clear all mocks
  clearMocks() {
    this.queryResults.clear();
    this.query.mockClear();
    this.connect.mockClear();
    this.end.mockClear();
  }
}

export const createMockPool = (): MockPool => {
  return new MockPool();
};

// Mock database helper functions
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890', // Mock bcrypt hash
  username: 'testuser',
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  is_verified: true,
};

export const mockArticle = {
  id: 'article-123',
  title: 'Test Article',
  content: 'This is a test article content',
  url: 'https://example.com/article',
  source_id: 'source-123',
  author: 'Test Author',
  published_at: new Date('2024-01-01'),
  category: 'technology',
  image_url: 'https://example.com/image.jpg',
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

export const mockSource = {
  id: 'source-123',
  name: 'Test News',
  url: 'https://example.com',
  rss_url: 'https://example.com/rss',
  category: 'technology',
  reliability_score: 0.9,
  is_active: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

export const mockStyleProfile = {
  id: 'style-123',
  user_id: 'user-123',
  name: 'Professional',
  description: 'A professional writing style',
  prompt: 'Rewrite in a professional tone',
  is_default: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

export const mockRewrittenArticle = {
  id: 'rewritten-123',
  article_id: 'article-123',
  style_profile_id: 'style-123',
  rewritten_content: 'This is the rewritten content',
  summary: 'Article summary',
  key_points: ['Point 1', 'Point 2'],
  created_at: new Date('2024-01-01'),
};
