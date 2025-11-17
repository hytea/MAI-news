# News Ingestion Engine

A comprehensive news ingestion system built with RSS feed parsing, web scraping, article deduplication, and background job processing using BullMQ.

## Features

### 1. RSS Feed Parser
- Parses RSS and Atom feeds using `rss-parser`
- Extracts article metadata (title, content, author, published date, images)
- Supports multiple content encodings (content:encoded, description, etc.)
- Automatic category detection based on keywords
- Handles various feed formats and custom fields

**Location**: `packages/api/src/services/rss-parser.service.ts`

### 2. Web Scraper
- Intelligent web scraping using Cheerio and Axios
- Extracts article content from various HTML structures
- Supports Open Graph and Twitter Card metadata
- Automatic image and author detection
- Configurable user agent and timeouts
- Fallback strategies for content extraction

**Location**: `packages/api/src/services/web-scraper.service.ts`

### 3. Article Deduplication
- Content-based deduplication using SHA-256 hashing
- URL-based duplicate detection
- Similarity scoring using Jaccard similarity
- Batch duplicate checking for efficiency
- Normalizes text before comparison

**Location**: `packages/api/src/services/deduplication.service.ts`

### 4. Background Job Processing
- BullMQ-based job queue with Redis
- Concurrent job processing (up to 5 jobs)
- Automatic retry with exponential backoff (3 attempts)
- Rate limiting (10 jobs per second)
- Job persistence and monitoring
- Detailed ingestion logs

**Location**: `packages/api/src/workers/ingestion.worker.ts`

### 5. News Ingestion Service
- Orchestrates the entire ingestion pipeline
- Manages source scheduling based on fetch frequency
- Provides ingestion statistics and logs
- Queue management (pause, resume, clean)
- Staggered job execution to avoid overwhelming sources

**Location**: `packages/api/src/services/news-ingestion.service.ts`

### 6. Periodic Scheduler
- Automatic ingestion scheduling every 15 minutes
- Smart scheduling based on source fetch frequency
- Only fetches sources that are due for update
- Graceful start/stop

**Location**: `packages/api/src/services/scheduler.service.ts`

## Database Schema

### Sources Table
```sql
- id: UUID (primary key)
- name: VARCHAR(255)
- url: VARCHAR(500) - Main website URL
- feed_url: VARCHAR(500) - RSS feed URL (optional)
- scrape_enabled: BOOLEAN - Enable web scraping
- reliability_score: INTEGER (0-100)
- favicon: VARCHAR(500)
- is_active: BOOLEAN
- last_fetched_at: TIMESTAMP
- fetch_frequency_minutes: INTEGER (default: 60)
```

### Articles Table
```sql
- id: UUID (primary key)
- source_id: UUID (foreign key)
- title: VARCHAR(500)
- original_content: TEXT
- url: VARCHAR(1000) - Unique
- author: VARCHAR(255)
- published_at: TIMESTAMP
- category: article_category ENUM
- image_url: VARCHAR(1000)
- importance_score: INTEGER (0-100)
- content_hash: VARCHAR(64) - SHA-256 hash for deduplication
```

### Ingestion Logs Table
```sql
- id: UUID (primary key)
- source_id: UUID (foreign key)
- job_type: VARCHAR(50) - 'rss' or 'scrape'
- status: VARCHAR(50) - 'pending', 'processing', 'completed', 'failed'
- articles_found: INTEGER
- articles_added: INTEGER
- articles_skipped: INTEGER (duplicates)
- error_message: TEXT
- started_at: TIMESTAMP
- completed_at: TIMESTAMP
```

## API Endpoints

### Source Management
- `GET /api/sources` - Get all sources
- `GET /api/sources/:id` - Get source by ID
- `POST /api/sources` - Create new source (authenticated)
- `PATCH /api/sources/:id` - Update source (authenticated)
- `DELETE /api/sources/:id` - Delete source (authenticated)
- `PATCH /api/sources/:id/toggle` - Toggle source active status (authenticated)

### Ingestion Control
- `POST /api/sources/:id/ingest` - Trigger ingestion for specific source (authenticated)
- `POST /api/sources/ingest-all` - Trigger ingestion for all sources (authenticated)
- `GET /api/sources/ingestion/stats` - Get ingestion statistics
- `GET /api/sources/ingestion/logs?limit=50` - Get ingestion logs

## Usage Examples

### 1. Add a New Source with RSS Feed

```bash
curl -X POST http://localhost:3001/api/sources \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TechCrunch",
    "url": "https://techcrunch.com",
    "feedUrl": "https://techcrunch.com/feed/",
    "scrapeEnabled": false,
    "reliabilityScore": 85,
    "fetchFrequencyMinutes": 30
  }'
```

### 2. Add a Source with Web Scraping

```bash
curl -X POST http://localhost:3001/api/sources \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom News Site",
    "url": "https://example.com",
    "scrapeEnabled": true,
    "fetchFrequencyMinutes": 60
  }'
```

### 3. Trigger Manual Ingestion

```bash
# For a specific source
curl -X POST http://localhost:3001/api/sources/{SOURCE_ID}/ingest \
  -H "Authorization: Bearer YOUR_TOKEN"

# For all sources
curl -X POST http://localhost:3001/api/sources/ingest-all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Check Ingestion Stats

```bash
curl http://localhost:3001/api/sources/ingestion/stats
```

Response:
```json
{
  "totalJobs": 150,
  "pendingJobs": 5,
  "completedJobs": 140,
  "failedJobs": 5
}
```

### 5. View Ingestion Logs

```bash
curl http://localhost:3001/api/sources/ingestion/logs?limit=20
```

## Configuration

### Environment Variables

```env
# Redis Configuration (required for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional_password

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=news_curator
DB_USER=postgres
DB_PASSWORD=postgres
```

### Scheduler Configuration

The scheduler runs every 15 minutes by default. You can adjust this in `src/index.ts`:

```typescript
scheduler = new SchedulerService(db, 15); // 15 minutes
```

### Worker Configuration

Worker concurrency and rate limits can be adjusted in `src/workers/ingestion.worker.ts`:

```typescript
concurrency: 5, // Process up to 5 jobs concurrently
limiter: {
  max: 10, // Max 10 jobs
  duration: 1000, // per second
}
```

## How It Works

### Ingestion Flow

1. **Scheduler triggers** periodic ingestion every 15 minutes
2. **NewsIngestionService** checks which sources are due for fetching
3. **Jobs are created** and added to the BullMQ queue with delays
4. **Workers process jobs** concurrently:
   - For RSS feeds: Parse feed → Extract articles
   - For web scraping: Fetch HTML → Extract content
5. **Deduplication** checks if article already exists
6. **Storage**: New articles are saved to database
7. **Logging**: Results are recorded in ingestion_logs table

### Deduplication Strategy

1. **URL Check**: First checks if URL already exists (exact match)
2. **Content Hash Check**: Generates SHA-256 hash of normalized title + first 500 chars of content
3. **Skip if duplicate**: Article is not inserted if either check matches
4. **Batch Processing**: For efficiency, can check multiple articles at once

### Error Handling

- **Automatic Retry**: Failed jobs retry up to 3 times with exponential backoff (2s, 4s, 8s)
- **Error Logging**: All errors are logged to ingestion_logs table
- **Graceful Degradation**: If one source fails, others continue processing
- **Job Persistence**: Failed jobs are kept for 7 days for debugging

## Monitoring

### View Queue Status

The ingestion stats endpoint provides real-time queue metrics:

```bash
GET /api/sources/ingestion/stats
```

### View Recent Logs

Check recent ingestion activity:

```bash
GET /api/sources/ingestion/logs?limit=50
```

### Redis Queue Dashboard

You can use BullMQ Board or other Redis GUI tools to monitor the queue:

```bash
npm install -g bull-board
```

## Performance Considerations

### Rate Limiting
- Worker processes max 10 jobs per second
- Jobs are staggered by 1 second to avoid overwhelming sources
- Respects HTTP rate limits and timeouts

### Resource Usage
- Worker concurrency limited to 5 jobs
- Database connection pool: 20 connections
- Redis connection reuse
- Completed jobs removed after 24 hours
- Failed jobs kept for 7 days

### Scaling
- Horizontal scaling: Run multiple worker instances
- Vertical scaling: Adjust worker concurrency
- Database optimization: Indexes on url, content_hash, published_at

## Development

### Running Migrations

```bash
cd packages/api
npm run migrate:up
```

### Starting the Server

```bash
npm run dev
```

This will start:
- Fastify API server
- BullMQ worker
- Periodic scheduler

### Testing Ingestion

1. Add a test source:
```bash
curl -X POST http://localhost:3001/api/sources \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hacker News",
    "url": "https://news.ycombinator.com",
    "feedUrl": "https://news.ycombinator.com/rss",
    "fetchFrequencyMinutes": 30
  }'
```

2. Trigger ingestion:
```bash
curl -X POST http://localhost:3001/api/sources/{SOURCE_ID}/ingest \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. Check logs:
```bash
curl http://localhost:3001/api/sources/ingestion/logs
```

## Troubleshooting

### Worker Not Processing Jobs

1. Check Redis connection:
```bash
redis-cli ping
```

2. Check worker logs in console output

3. Verify queue status:
```bash
GET /api/sources/ingestion/stats
```

### High Duplicate Rate

- Adjust content hash algorithm in `deduplication.service.ts`
- Check if source is publishing duplicate content
- Review `fetch_frequency_minutes` setting

### Failed Jobs

1. Check ingestion logs for error messages
2. Verify source URLs are accessible
3. Test RSS feed/URL manually
4. Check network/firewall settings

## Future Enhancements

- [ ] Add support for Atom feeds with full content
- [ ] Implement smart content extraction using AI
- [ ] Add webhook support for real-time ingestion
- [ ] Create admin dashboard for monitoring
- [ ] Add support for authenticated feeds
- [ ] Implement article importance scoring
- [ ] Add support for multi-language content
- [ ] Create source reliability scoring system
- [ ] Add support for podcast feeds
- [ ] Implement content filtering rules
