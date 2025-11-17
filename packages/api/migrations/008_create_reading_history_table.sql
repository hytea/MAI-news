-- Create reading_history table
CREATE TABLE IF NOT EXISTS reading_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  rewritten_article_id UUID REFERENCES rewritten_articles(id) ON DELETE SET NULL,
  reading_time_seconds INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reading_history_user_id ON reading_history(user_id);
CREATE INDEX idx_reading_history_article_id ON reading_history(article_id);
CREATE INDEX idx_reading_history_created_at ON reading_history(created_at DESC);

-- Create saved_articles table
CREATE TABLE IF NOT EXISTS saved_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_saved_article UNIQUE (user_id, article_id)
);

CREATE INDEX idx_saved_articles_user_id ON saved_articles(user_id);
CREATE INDEX idx_saved_articles_article_id ON saved_articles(article_id);
