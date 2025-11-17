-- Create citations table
CREATE TABLE IF NOT EXISTS citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rewritten_article_id UUID NOT NULL REFERENCES rewritten_articles(id) ON DELETE CASCADE,
  source_article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  url VARCHAR(1000),
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_citations_rewritten_article_id ON citations(rewritten_article_id);
CREATE INDEX idx_citations_source_article_id ON citations(source_article_id);
