import { beforeAll, afterAll, beforeEach } from '@jest/globals';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.HOST = '0.0.0.0';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'news_curator_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.AI_PROVIDER = 'openrouter';
process.env.AI_API_KEY = 'test-api-key';
process.env.AI_MODEL = 'anthropic/claude-3-haiku';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Global test timeout
jest.setTimeout(10000);

// Suppress console output during tests (optional)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

beforeAll(() => {
  // Global setup
});

afterAll(() => {
  // Global teardown
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});
