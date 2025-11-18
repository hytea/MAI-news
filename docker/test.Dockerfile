# Multi-stage Dockerfile for running tests in a consistent environment

FROM node:18-alpine AS base

# Install necessary tools
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/ai-providers/package*.json ./packages/ai-providers/
COPY packages/api/package*.json ./packages/api/
COPY packages/web/package*.json ./packages/web/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build shared packages first
RUN npm run build --workspace=@news-curator/shared
RUN npm run build --workspace=@news-curator/ai-providers

# Test stage - runs all tests
FROM base AS test

# Set environment for testing
ENV NODE_ENV=test
ENV CI=true

# Create test database configuration
ENV DB_HOST=postgres-test
ENV DB_PORT=5432
ENV DB_NAME=news_curator_test
ENV DB_USER=postgres
ENV DB_PASSWORD=postgres

# Redis configuration
ENV REDIS_HOST=redis-test
ENV REDIS_PORT=6379

# JWT secrets for testing
ENV JWT_SECRET=test-jwt-secret-for-automated-testing
ENV JWT_REFRESH_SECRET=test-jwt-refresh-secret-for-automated-testing
ENV JWT_EXPIRES_IN=1h
ENV JWT_REFRESH_EXPIRES_IN=7d

# AI Provider (mocked in tests)
ENV AI_PROVIDER=openrouter
ENV AI_API_KEY=test-api-key
ENV AI_MODEL=anthropic/claude-3-haiku

# Run tests
CMD ["npm", "run", "test:all"]

# Coverage stage - generates coverage reports
FROM test AS coverage

CMD ["npm", "run", "test:coverage"]

# API tests only
FROM base AS test-api

ENV NODE_ENV=test
ENV DB_HOST=postgres-test
ENV DB_PORT=5432
ENV DB_NAME=news_curator_test
ENV DB_USER=postgres
ENV DB_PASSWORD=postgres
ENV REDIS_HOST=redis-test
ENV REDIS_PORT=6379
ENV JWT_SECRET=test-jwt-secret
ENV JWT_REFRESH_SECRET=test-jwt-refresh-secret
ENV JWT_EXPIRES_IN=1h
ENV JWT_REFRESH_EXPIRES_IN=7d
ENV AI_PROVIDER=openrouter
ENV AI_API_KEY=test-api-key
ENV AI_MODEL=anthropic/claude-3-haiku

CMD ["npm", "run", "test", "--workspace=@news-curator/api"]

# Web tests only
FROM base AS test-web

ENV NODE_ENV=test
ENV VITE_API_URL=http://localhost:3001

CMD ["npm", "run", "test", "--workspace=@news-curator/web"]

# Shared tests only
FROM base AS test-shared

ENV NODE_ENV=test

CMD ["npm", "run", "test", "--workspace=@news-curator/shared"]
