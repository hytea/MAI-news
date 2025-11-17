-- Create user_preferences table
CREATE TYPE preferred_reading_time AS ENUM ('morning', 'afternoon', 'evening');

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  followed_categories article_category[] DEFAULT '{}',
  muted_categories article_category[] DEFAULT '{}',
  followed_sources UUID[] DEFAULT '{}',
  muted_sources UUID[] DEFAULT '{}',
  default_style_profile_id UUID REFERENCES style_profiles(id) ON DELETE SET NULL,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  email_digest_enabled BOOLEAN DEFAULT FALSE,
  email_digest_time TIME,
  breaking_news_alerts BOOLEAN DEFAULT FALSE,
  preferred_reading_time preferred_reading_time DEFAULT 'morning',
  articles_per_session INTEGER CHECK (articles_per_session >= 1 AND articles_per_session <= 50) DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Apply updated_at trigger
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
