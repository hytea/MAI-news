# Article Rewriting System

A comprehensive system for rewriting news articles using AI providers with personalized style profiles, citation extraction, and intelligent caching.

## Overview

The Article Rewriting System is a core feature of the News Curator platform that transforms news articles into personalized versions matching each user's preferred reading style while maintaining factual accuracy and providing transparent source citations.

## Architecture

### Components

1. **Article Rewriting Service** (`packages/api/src/services/article-rewriting.service.ts`)
   - Main orchestration service
   - Coordinates AI providers, caching, and citation extraction
   - Manages rewritten article storage and retrieval

2. **Citation Extraction Service** (`packages/api/src/services/citation-extraction.service.ts`)
   - Extracts citations from rewritten content
   - Supports multiple citation formats
   - Stores citations with proper attribution

3. **Article Cache Service** (`packages/api/src/services/article-cache.service.ts`)
   - Redis-based caching layer
   - Reduces AI processing costs
   - Improves response times
   - Smart cache invalidation

4. **AI Provider Integration** (`packages/ai-providers/`)
   - Pluggable AI provider architecture
   - OpenRouter implementation (supports multiple models)
   - Cost tracking and estimation

## Features

### 1. Style Profile Application

Users can rewrite articles in various predefined styles:

- **Conversational**: Casual, friendly tone
- **Academic**: Formal, scholarly writing
- **Bullet Point**: Concise, structured summary
- **ELI5** (Explain Like I'm 5): Simple, accessible language
- **Executive**: Brief, high-level overview
- **Technical**: Detailed, technical analysis
- **Custom**: User-defined style with custom prompts

Each style profile can be configured with:
- Tone (formal, casual, neutral)
- Length (concise, medium, detailed)
- Technical level (1-10)
- Context inclusion
- Key points extraction

### 2. Citation Extraction

The system automatically extracts citations from rewritten content using multiple patterns:

- Markdown-style citations: `[Source: text](url)`
- Custom format: `[Citation: text - url]`
- Parenthetical: `(Source: text)`

Features:
- Automatic source article citation
- Position tracking for inline citations
- URL validation and storage
- Citation grouping by rewritten article

### 3. Intelligent Caching Layer

Redis-based caching provides:

- **24-hour TTL** for rewritten articles
- **Cache keys** based on: article ID, user ID, style profile ID
- **Automatic invalidation** when:
  - User updates style profile
  - Article is deleted
  - User explicitly clears cache
- **Cache statistics** for monitoring

### 4. AI Provider Integration

Pluggable architecture supports multiple AI providers:

- **OpenRouter** (implemented)
  - Support for Claude, GPT, Llama, and other models
  - Rate limiting (10 concurrent requests)
  - Automatic retry with exponential backoff
  - Cost estimation and tracking

- **OpenAI** (planned)
- **Anthropic** (planned)

## Database Schema

### Rewritten Articles Table

```sql
CREATE TABLE rewritten_articles (
  id UUID PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES articles(id),
  user_id UUID NOT NULL REFERENCES users(id),
  style_profile_id UUID NOT NULL REFERENCES style_profiles(id),
  rewritten_content TEXT NOT NULL,
  summary TEXT,
  key_points JSONB,
  processing_time_ms INTEGER,
  ai_cost DECIMAL(10, 6),
  created_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (article_id, user_id, style_profile_id)
);
```

### Citations Table

```sql
CREATE TABLE citations (
  id UUID PRIMARY KEY,
  rewritten_article_id UUID NOT NULL REFERENCES rewritten_articles(id),
  source_article_id UUID REFERENCES articles(id),
  text TEXT NOT NULL,
  url VARCHAR(1000),
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE
);
```

### Style Profiles Table

```sql
CREATE TABLE style_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  predefined_style predefined_style,
  custom_prompt TEXT,
  tone tone_type DEFAULT 'neutral',
  length length_type DEFAULT 'medium',
  technical_level INTEGER DEFAULT 5,
  include_context BOOLEAN DEFAULT TRUE,
  include_key_points BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

## API Endpoints

### Rewrite Article

```http
POST /api/articles/:id/rewrite
Authorization: Bearer <token>
Content-Type: application/json

{
  "styleProfileId": "uuid",
  "skipCache": false,
  "includeKeyPoints": true,
  "includeSummary": true
}
```

**Response:**

```json
{
  "rewrittenArticle": {
    "id": "uuid",
    "articleId": "uuid",
    "userId": "uuid",
    "styleProfileId": "uuid",
    "rewrittenContent": "...",
    "summary": "...",
    "keyPoints": ["...", "..."],
    "processingTimeMs": 2500,
    "aiCost": 0.0015,
    "createdAt": "2025-11-17T...",
    "article": { ... },
    "citations": [ ... ]
  }
}
```

### Get Rewritten Article

```http
GET /api/articles/:id/rewritten/:styleProfileId
Authorization: Bearer <token>
```

### Get User's Rewritten Articles

```http
GET /api/articles/rewritten/my-articles?limit=50&offset=0
Authorization: Bearer <token>
```

### Delete Rewritten Article

```http
DELETE /api/articles/rewritten/:id
Authorization: Bearer <token>
```

### Cache Management

```http
# Get cache statistics
GET /api/articles/cache/stats
Authorization: Bearer <token>

# Clear user's cache
DELETE /api/articles/cache/my-cache
Authorization: Bearer <token>
```

## Usage Examples

### 1. Rewrite Article in Conversational Style

```typescript
// Create a conversational style profile first
const styleProfile = await fetch('/api/style-profiles', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Conversational',
    predefinedStyle: 'conversational',
    tone: 'casual',
    length: 'medium',
    technicalLevel: 3,
  }),
});

// Rewrite article
const result = await fetch(`/api/articles/${articleId}/rewrite`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    styleProfileId: styleProfile.id,
  }),
});

console.log(result.rewrittenArticle.rewrittenContent);
```

### 2. Get Cached Rewrite

```typescript
// First request - processes with AI
const first = await fetch(`/api/articles/${articleId}/rewrite`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ styleProfileId }),
});
console.log('Processing time:', first.rewrittenArticle.processingTimeMs); // ~2500ms

// Second request - served from cache
const second = await fetch(`/api/articles/${articleId}/rewritten/${styleProfileId}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});
console.log('Cached response (instant)');
```

### 3. Force Re-process Article

```typescript
// Skip cache to regenerate with updated style
const result = await fetch(`/api/articles/${articleId}/rewrite`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    styleProfileId,
    skipCache: true,
  }),
});
```

## Configuration

### Environment Variables

```env
# AI Provider Configuration
AI_PROVIDER=openrouter
AI_API_KEY=your-api-key
AI_MODEL=anthropic/claude-3-haiku

# Recommended models:
# - anthropic/claude-3-haiku (fast, cost-effective)
# - anthropic/claude-3-sonnet (balanced)
# - anthropic/claude-3-opus (highest quality)
# - openai/gpt-4-turbo
# - openai/gpt-3.5-turbo

# Redis Configuration (for caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Cost Optimization

The system includes several features to minimize AI costs:

1. **Caching**: 24-hour cache prevents redundant processing
2. **Model Selection**: Use cost-effective models like Claude Haiku for most rewrites
3. **Cost Tracking**: Monitor per-user costs in the database
4. **Batch Processing**: Process multiple articles efficiently

**Example Cost Comparison:**

| Model | Input Cost (per 1M tokens) | Output Cost (per 1M tokens) | Typical Article Cost |
|-------|---------------------------|-----------------------------|---------------------|
| Claude 3 Haiku | $0.25 | $1.25 | $0.002 |
| Claude 3 Sonnet | $3.00 | $15.00 | $0.025 |
| GPT-3.5 Turbo | $0.50 | $1.50 | $0.003 |
| GPT-4 Turbo | $10.00 | $30.00 | $0.060 |

## Performance Metrics

### Processing Times

- **Cache Hit**: < 50ms
- **Cache Miss (AI Processing)**:
  - Claude 3 Haiku: ~2-4 seconds
  - Claude 3 Sonnet: ~4-8 seconds
  - GPT-4 Turbo: ~5-10 seconds

### Cache Efficiency

- **Hit Rate (expected)**: 70-85%
- **TTL**: 24 hours
- **Memory Usage**: ~50KB per cached article

## Error Handling

The system includes comprehensive error handling:

```typescript
try {
  const result = await rewritingService.rewriteArticle(...);
} catch (error) {
  if (error instanceof AIProviderError) {
    // Handle AI provider errors (rate limits, API errors)
    console.error('AI Provider Error:', error.message);
  } else if (error instanceof DatabaseError) {
    // Handle database errors
    console.error('Database Error:', error.message);
  } else if (error instanceof ValidationError) {
    // Handle validation errors
    console.error('Validation Error:', error.message);
  }
}
```

### Common Errors

- **AI_PROVIDER_ERROR**: AI provider failure, rate limit, or invalid response
- **DATABASE_ERROR**: Database query failure or constraint violation
- **VALIDATION_ERROR**: Invalid input parameters
- **NOT_FOUND**: Article or style profile not found

## Monitoring

### Cache Statistics

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/articles/cache/stats
```

Response:
```json
{
  "stats": {
    "totalCachedArticles": 1543,
    "memoryUsed": "77.15M"
  }
}
```

### Database Queries

Monitor rewriting activity:

```sql
-- Most popular style profiles
SELECT sp.name, sp.usage_count
FROM style_profiles sp
ORDER BY sp.usage_count DESC
LIMIT 10;

-- Average processing time by model
SELECT AVG(processing_time_ms) as avg_time, COUNT(*) as count
FROM rewritten_articles
WHERE created_at > NOW() - INTERVAL '7 days';

-- Total AI costs
SELECT SUM(ai_cost) as total_cost
FROM rewritten_articles
WHERE created_at > NOW() - INTERVAL '1 month';
```

## Best Practices

### 1. Style Profile Management

- Create reusable style profiles for common use cases
- Use public profiles to share popular styles
- Set one profile as default per user
- Update profiles instead of creating duplicates

### 2. Caching Strategy

- Don't skip cache unless necessary (e.g., style profile updated)
- Clear cache when changing style profile settings
- Monitor cache hit rate and adjust TTL if needed

### 3. Cost Management

- Use Claude Haiku for most rewrites (80% cheaper than GPT-4)
- Reserve premium models for high-value content
- Set up cost alerts and limits per user
- Monitor daily/monthly spending

### 4. Performance Optimization

- Implement request debouncing on frontend
- Show loading states during AI processing
- Cache aggressively on client side
- Use pagination for listing rewritten articles

## Future Enhancements

- [ ] Background job queue for bulk rewriting
- [ ] A/B testing different AI prompts
- [ ] Multi-language support
- [ ] Sentiment preservation across rewrites
- [ ] Style transfer learning from user feedback
- [ ] Real-time streaming of rewritten content
- [ ] Collaborative style profiles
- [ ] Version history for rewrites
- [ ] Advanced citation formatting (APA, MLA, Chicago)
- [ ] Integration with fact-checking APIs

## Troubleshooting

### Issue: High AI Costs

**Solution:**
- Switch to Claude Haiku or GPT-3.5 Turbo
- Reduce max tokens in provider config
- Implement per-user daily limits
- Increase cache TTL to 48 hours

### Issue: Slow Processing Times

**Solution:**
- Check AI provider status
- Verify network connectivity
- Increase worker concurrency
- Use faster models (Haiku vs Opus)

### Issue: Poor Rewrite Quality

**Solution:**
- Upgrade to better model (Sonnet or Opus)
- Adjust style profile prompts
- Increase technical level if too simple
- Enable context inclusion in style profile

### Issue: Cache Not Working

**Solution:**
- Verify Redis connection
- Check Redis memory usage
- Ensure cache keys are unique
- Review cache invalidation logic

## Support

For issues or questions:

- Check the [GitHub Issues](https://github.com/yourusername/news-curator/issues)
- Review the [API Documentation](./packages/api/README.md)
- Contact support@news-curator.com
