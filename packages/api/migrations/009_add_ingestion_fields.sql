-- Add ingestion-related fields to sources table
ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS feed_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS scrape_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS fetch_frequency_minutes INTEGER DEFAULT 60;

CREATE INDEX idx_sources_feed_url ON sources(feed_url) WHERE feed_url IS NOT NULL;
CREATE INDEX idx_sources_last_fetched ON sources(last_fetched_at);

-- Add content hash to articles table for deduplication
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64) UNIQUE;

CREATE INDEX idx_articles_content_hash ON articles(content_hash);

-- Create ingestion_logs table to track ingestion jobs
CREATE TABLE IF NOT EXISTS ingestion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL, -- 'rss' or 'scrape'
  status VARCHAR(50) NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  articles_found INTEGER DEFAULT 0,
  articles_added INTEGER DEFAULT 0,
  articles_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ingestion_logs_source_id ON ingestion_logs(source_id);
CREATE INDEX idx_ingestion_logs_status ON ingestion_logs(status);
CREATE INDEX idx_ingestion_logs_created_at ON ingestion_logs(created_at DESC);
