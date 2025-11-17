import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface EnvConfig {
  // Server
  NODE_ENV: string;
  PORT: number;
  HOST: string;

  // Database
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;

  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;

  // AI Provider
  AI_PROVIDER: 'openrouter' | 'openai' | 'anthropic';
  AI_API_KEY: string;
  AI_MODEL: string;

  // Redis (for queue)
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;

  // Email (for verification)
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  EMAIL_FROM?: string;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Invalid number for environment variable ${key}: ${value}`);
  }
  return num;
}

export const env: EnvConfig = {
  // Server
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  PORT: getEnvNumber('PORT', 3001),
  HOST: getEnv('HOST', '0.0.0.0'),

  // Database
  DB_HOST: getEnv('DB_HOST', 'localhost'),
  DB_PORT: getEnvNumber('DB_PORT', 5432),
  DB_NAME: getEnv('DB_NAME', 'news_curator'),
  DB_USER: getEnv('DB_USER', 'postgres'),
  DB_PASSWORD: getEnv('DB_PASSWORD', 'postgres'),

  // JWT
  JWT_SECRET: getEnv('JWT_SECRET', 'your-secret-key-change-in-production'),
  JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN', '1d'),
  JWT_REFRESH_SECRET: getEnv('JWT_REFRESH_SECRET', 'your-refresh-secret-key'),
  JWT_REFRESH_EXPIRES_IN: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),

  // AI Provider
  AI_PROVIDER: getEnv('AI_PROVIDER', 'openrouter') as 'openrouter',
  AI_API_KEY: getEnv('AI_API_KEY', ''),
  AI_MODEL: getEnv('AI_MODEL', 'anthropic/claude-3-haiku'),

  // Redis
  REDIS_HOST: getEnv('REDIS_HOST', 'localhost'),
  REDIS_PORT: getEnvNumber('REDIS_PORT', 6379),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,

  // Email
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@news-curator.com',
};
