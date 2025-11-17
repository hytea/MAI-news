-- Create article categories enum
CREATE TYPE article_category AS ENUM (
  'politics',
  'technology',
  'business',
  'science',
  'health',
  'entertainment',
  'sports',
  'world',
  'other'
);

-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  original_content TEXT NOT NULL,
  url VARCHAR(1000) UNIQUE NOT NULL,
  author VARCHAR(255),
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  category article_category NOT NULL DEFAULT 'other',
  image_url VARCHAR(1000),
  importance_score INTEGER CHECK (importance_score >= 0 AND importance_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_articles_source_id ON articles(source_id);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_importance_score ON articles(importance_score DESC);
CREATE INDEX idx_articles_url ON articles(url);

-- Apply updated_at trigger
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
