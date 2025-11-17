-- Create rewritten_articles table
CREATE TABLE IF NOT EXISTS rewritten_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  style_profile_id UUID NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,
  rewritten_content TEXT NOT NULL,
  summary TEXT,
  key_points JSONB,
  processing_time_ms INTEGER,
  ai_cost DECIMAL(10, 6),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_article_user_style UNIQUE (article_id, user_id, style_profile_id)
);

CREATE INDEX idx_rewritten_articles_article_id ON rewritten_articles(article_id);
CREATE INDEX idx_rewritten_articles_user_id ON rewritten_articles(user_id);
CREATE INDEX idx_rewritten_articles_style_profile_id ON rewritten_articles(style_profile_id);
CREATE INDEX idx_rewritten_articles_created_at ON rewritten_articles(created_at DESC);
