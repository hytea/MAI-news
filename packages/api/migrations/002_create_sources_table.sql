-- Create sources table
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500) UNIQUE NOT NULL,
  reliability_score INTEGER CHECK (reliability_score >= 0 AND reliability_score <= 100),
  favicon VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sources_is_active ON sources(is_active);
CREATE INDEX idx_sources_url ON sources(url);

-- Apply updated_at trigger
CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
