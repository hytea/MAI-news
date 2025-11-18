# Testing Guide for News Curator

This document provides comprehensive information about the testing infrastructure and how to run tests in the News Curator application.

## Table of Contents

- [Overview](#overview)
- [Testing Stack](#testing-stack)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Docker Testing](#docker-testing)
- [Writing Tests](#writing-tests)
- [Coverage Reports](#coverage-reports)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

The News Curator project includes a comprehensive testing suite designed to run consistently across different environments. All tests can be executed locally or in isolated Docker containers to ensure reproducible results.

### Test Coverage

- **Backend (API)**
  - Unit tests for services (Auth, JWT, Article Caching, etc.)
  - Integration tests for API routes
  - Middleware tests
  - Database operation tests (mocked)
  - Redis caching tests (mocked)
  - AI provider integration tests (mocked)

- **Frontend (Web)**
  - Component tests
  - Hook tests
  - Utility function tests
  - Page tests

- **Shared Packages**
  - Type validation tests
  - Utility function tests

## Testing Stack

### Backend (API)
- **Framework**: Jest 29.7.0
- **Utilities**: ts-jest for TypeScript support
- **Mocking**: Built-in Jest mocks + custom mocks for Database, Redis, AI Provider
- **Coverage**: Jest coverage reporter

### Frontend (Web)
- **Framework**: Vitest 1.0.4
- **Testing Library**: @testing-library/react
- **Environment**: jsdom
- **Utilities**: @testing-library/user-event, @testing-library/jest-dom
- **Coverage**: Vitest coverage (v8 provider)

### Infrastructure
- **Docker**: Isolated test containers for PostgreSQL and Redis
- **Docker Compose**: Orchestration for test environment

## Test Structure

```
packages/
├── api/
│   ├── src/
│   │   ├── __tests__/
│   │   │   ├── setup.ts                    # Global test setup
│   │   │   └── mocks/
│   │   │       ├── database.mock.ts        # Database mocking utilities
│   │   │       ├── redis.mock.ts           # Redis mocking utilities
│   │   │       └── ai-provider.mock.ts     # AI provider mocks
│   │   ├── services/
│   │   │   └── __tests__/
│   │   │       ├── jwt.service.test.ts
│   │   │       ├── auth.service.test.ts
│   │   │       └── article-cache.service.test.ts
│   │   └── middleware/
│   │       └── __tests__/
│   │           └── auth.middleware.test.ts
│   └── jest.config.js
│
├── web/
│   ├── src/
│   │   ├── __tests__/
│   │   │   └── setup.ts                    # Vitest setup
│   │   └── components/
│   │       └── __tests__/
│   │           └── ArticleCard.test.tsx
│   └── vitest.config.ts
│
└── shared/
    └── (tests to be added)
```

## Running Tests

### Quick Start

```bash
# Run all tests locally
npm test

# Run tests with coverage
npm run test:coverage

# Run specific package tests
npm run test:api      # API tests only
npm run test:web      # Frontend tests only
npm run test:shared   # Shared package tests only
```

### Using the Test Runner Script

The `scripts/run-tests.sh` script provides a convenient interface for running tests:

```bash
# Make the script executable (first time only)
chmod +x scripts/run-tests.sh

# Run all tests locally
./scripts/run-tests.sh

# Run with coverage
./scripts/run-tests.sh --coverage
# or
./scripts/run-tests.sh coverage

# Run specific test suite
./scripts/run-tests.sh api
./scripts/run-tests.sh web

# Run in watch mode (local only)
./scripts/run-tests.sh --watch api

# Show help
./scripts/run-tests.sh --help
```

### Package-Specific Commands

#### API Package

```bash
cd packages/api

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

#### Web Package

```bash
cd packages/web

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI (interactive)
npm run test:ui
```

## Docker Testing

Docker testing ensures that tests run in a consistent, isolated environment that matches production conditions.

### Why Docker Testing?

- ✅ **Consistent Environment**: Same results on all machines
- ✅ **Isolated Dependencies**: PostgreSQL and Redis in containers
- ✅ **CI/CD Ready**: Easy integration with GitHub Actions, GitLab CI, etc.
- ✅ **No Local Setup**: No need to install PostgreSQL/Redis locally
- ✅ **Clean State**: Fresh database for each test run

### Docker Test Architecture

```
┌─────────────────────────────────────────┐
│     Docker Test Environment             │
│                                         │
│  ┌────────────┐  ┌──────────────────┐  │
│  │ PostgreSQL │  │   Redis Cache    │  │
│  │  (Test DB) │  │  (Test Instance) │  │
│  └────────────┘  └──────────────────┘  │
│         ▲                ▲              │
│         │                │              │
│         └────────┬───────┘              │
│                  │                      │
│         ┌────────▼────────┐             │
│         │   Test Runner   │             │
│         │  (API/Web/All)  │             │
│         └─────────────────┘             │
└─────────────────────────────────────────┘
```

### Running Tests in Docker

```bash
# Run all tests in Docker
npm run test:docker
# or
./scripts/run-tests.sh --docker

# Run with coverage in Docker
npm run test:docker:coverage
# or
./scripts/run-tests.sh --docker --coverage

# Run specific test suite in Docker
npm run test:docker:api
npm run test:docker:web
# or
./scripts/run-tests.sh --docker api
./scripts/run-tests.sh --docker web

# Clean Docker volumes before running
./scripts/run-tests.sh --docker --clean

# Clean up Docker containers and volumes
npm run test:docker:clean
```

### Docker Compose Services

The `docker-compose.test.yml` file defines the following services:

- **postgres-test**: PostgreSQL 16 test database (port 5433)
- **redis-test**: Redis 7 test instance (port 6380)
- **test-all**: Runs all tests
- **test-coverage**: Runs tests with coverage
- **test-api**: Runs only API tests
- **test-web**: Runs only web tests
- **test-shared**: Runs only shared package tests

## Writing Tests

### Backend Tests (Jest)

#### Service Test Example

```typescript
// packages/api/src/services/__tests__/example.service.test.ts
import { ExampleService } from '../example.service';
import { createMockPool } from '../../__tests__/mocks/database.mock';

describe('ExampleService', () => {
  let service: ExampleService;
  let mockPool: any;

  beforeEach(() => {
    mockPool = createMockPool();
    service = new ExampleService(mockPool);
  });

  afterEach(() => {
    mockPool.clearMocks();
  });

  describe('methodName', () => {
    it('should do something', async () => {
      // Arrange
      mockPool.setQueryResult('SELECT ...', {
        rows: [{ id: '123', name: 'Test' }],
      });

      // Act
      const result = await service.methodName('123');

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('123');
    });

    it('should handle errors', async () => {
      // Arrange
      mockPool.query.mockRejectedValueOnce(new Error('DB Error'));

      // Act & Assert
      await expect(service.methodName('123')).rejects.toThrow('DB Error');
    });
  });
});
```

#### Using Mocks

```typescript
import { createMockRedis } from '../../__tests__/mocks/redis.mock';
import { createMockAIProvider } from '../../__tests__/mocks/ai-provider.mock';

const mockRedis = createMockRedis();
const mockAI = createMockAIProvider();

// Set up mock behavior
mockRedis.get.mockResolvedValue('cached-value');
mockAI.rewriteArticle.mockResolvedValue({
  rewrittenContent: 'New content',
  summary: 'Summary',
  keyPoints: ['Point 1', 'Point 2'],
});
```

### Frontend Tests (Vitest + React Testing Library)

#### Component Test Example

```typescript
// packages/web/src/components/__tests__/Example.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Example } from '../Example';

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Example Component', () => {
  it('should render correctly', () => {
    renderWithRouter(<Example title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const onClick = vi.fn();
    renderWithRouter(<Example onClick={onClick} />);

    const button = screen.getByRole('button');
    await fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

## Coverage Reports

### Generating Coverage

```bash
# All packages
npm run test:coverage

# Specific package
npm run test:coverage --workspace=@news-curator/api
npm run test:coverage --workspace=@news-curator/web

# In Docker
npm run test:docker:coverage
```

### Viewing Coverage Reports

Coverage reports are generated in HTML format:

- **API Coverage**: `packages/api/coverage/index.html`
- **Web Coverage**: `packages/web/coverage/index.html`

Open these files in a browser to view detailed coverage information.

### Coverage Thresholds

Current coverage thresholds are not enforced but recommended:

- **Statements**: 70%
- **Branches**: 65%
- **Functions**: 70%
- **Lines**: 70%

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests in Docker
        run: npm run test:docker

      - name: Generate coverage
        run: npm run test:docker:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./packages/api/coverage/lcov.info,./packages/web/coverage/lcov.info
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Problem**: Docker containers fail to start due to port conflicts.

**Solution**:
```bash
# Check what's using the ports
lsof -i :5433  # PostgreSQL test port
lsof -i :6380  # Redis test port

# Stop conflicting services or clean Docker volumes
npm run test:docker:clean
```

#### 2. Tests Pass Locally but Fail in Docker

**Problem**: Environment differences between local and Docker.

**Solution**:
- Check environment variables in `docker-compose.test.yml`
- Ensure all dependencies are in `package.json` (not global)
- Verify file paths are relative, not absolute

#### 3. Module Not Found Errors

**Problem**: Import errors in tests.

**Solution**:
```bash
# Rebuild packages
npm run build

# Reinstall dependencies
rm -rf node_modules packages/*/node_modules
npm install
```

#### 4. Jest Watch Mode Not Working

**Problem**: Watch mode doesn't detect changes.

**Solution**:
```bash
# Clear Jest cache
npx jest --clearCache

# Run with --no-cache
npx jest --no-cache --watch
```

#### 5. Memory Issues in Docker

**Problem**: Tests crash due to insufficient memory.

**Solution**:
```bash
# Increase Docker memory limit in Docker Desktop settings
# Or use --max-old-space-size flag
NODE_OPTIONS="--max-old-space-size=4096" npm test
```

### Debug Mode

Run tests with verbose output:

```bash
# Jest (API)
npm test -- --verbose

# Vitest (Web)
npm test -- --reporter=verbose

# Docker with logs
docker-compose -f docker-compose.test.yml up --build test-all
```

## Best Practices

1. **Write tests alongside code**: Create test files when implementing features
2. **Use descriptive test names**: Clearly describe what is being tested
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Mock external dependencies**: Use provided mocks for database, Redis, AI
5. **Test edge cases**: Don't just test the happy path
6. **Keep tests isolated**: Each test should be independent
7. **Use Docker for CI**: Ensure consistent results across environments
8. **Maintain coverage**: Aim for >70% coverage on critical code
9. **Run tests before committing**: Use git hooks or manual checks
10. **Update tests with code changes**: Keep tests in sync with implementation

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Docker Documentation](https://docs.docker.com/)

---

**Need Help?** Check the main README.md or open an issue in the repository.
