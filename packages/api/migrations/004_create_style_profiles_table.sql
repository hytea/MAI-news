-- Create style enum
CREATE TYPE predefined_style AS ENUM (
  'conversational',
  'academic',
  'bullet_point',
  'eli5',
  'executive',
  'technical',
  'casual'
);

CREATE TYPE tone_type AS ENUM ('formal', 'casual', 'neutral');
CREATE TYPE length_type AS ENUM ('concise', 'medium', 'detailed');

-- Create style_profiles table
CREATE TABLE IF NOT EXISTS style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  predefined_style predefined_style,
  custom_prompt TEXT,
  tone tone_type DEFAULT 'neutral',
  length length_type DEFAULT 'medium',
  technical_level INTEGER CHECK (technical_level >= 1 AND technical_level <= 10) DEFAULT 5,
  include_context BOOLEAN DEFAULT TRUE,
  include_key_points BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_default_style UNIQUE (user_id, is_default) WHERE is_default = TRUE
);

CREATE INDEX idx_style_profiles_user_id ON style_profiles(user_id);
CREATE INDEX idx_style_profiles_is_public ON style_profiles(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_style_profiles_usage_count ON style_profiles(usage_count DESC);

-- Apply updated_at trigger
CREATE TRIGGER update_style_profiles_updated_at BEFORE UPDATE ON style_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
