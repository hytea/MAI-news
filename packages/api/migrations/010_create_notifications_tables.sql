-- Migration: Create notifications tables
-- Description: Tables for notification system (in-app, email, push)

-- Notifications table (in-app notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    action_url TEXT,
    image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'sent',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    read_at TIMESTAMP,
    expires_at TIMESTAMP,
    CONSTRAINT valid_type CHECK (type IN (
        'breaking_news', 'daily_digest', 'article_recommendation',
        'reading_streak', 'comment_reply', 'system_alert'
    )),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read'))
);

-- Indexes for efficient querying
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, status) WHERE status != 'read';

-- Push subscriptions table (for web push notifications)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_data JSONB NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP,
    expires_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Notification preferences table (extends user_preferences)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    push_enabled BOOLEAN NOT NULL DEFAULT true,
    in_app_enabled BOOLEAN NOT NULL DEFAULT true,
    breaking_news_enabled BOOLEAN NOT NULL DEFAULT true,
    daily_digest_enabled BOOLEAN NOT NULL DEFAULT true,
    daily_digest_time TIME DEFAULT '08:00:00',
    article_recommendations_enabled BOOLEAN NOT NULL DEFAULT true,
    reading_streak_enabled BOOLEAN NOT NULL DEFAULT true,
    comment_replies_enabled BOOLEAN NOT NULL DEFAULT true,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    preferred_channels TEXT[] DEFAULT ARRAY['email', 'in_app'],
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Notification logs table (for tracking all sent notifications across channels)
CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    external_id TEXT,
    error_message TEXT,
    metadata JSONB,
    sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_channel CHECK (channel IN ('email', 'push', 'in_app', 'sms'))
);

-- Indexes
CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_channel ON notification_logs(channel);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_sent_at ON notification_logs(sent_at DESC);

-- Email templates table (for managing notification email templates)
CREATE TABLE IF NOT EXISTS notification_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    html_template TEXT,
    variables TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_notification_templates_type ON notification_templates(type);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Insert default notification templates
INSERT INTO notification_templates (name, type, subject_template, body_template, html_template, variables) VALUES
(
    'breaking_news',
    'breaking_news',
    'Breaking News: {{title}}',
    'Hi {{userName}},\n\nWe have breaking news for you:\n\n{{articleTitle}}\n\n{{summary}}\n\nRead more: {{url}}',
    '<h2>{{articleTitle}}</h2><p>{{summary}}</p><a href="{{url}}">Read more</a>',
    ARRAY['userName', 'articleTitle', 'summary', 'url']
),
(
    'daily_digest',
    'daily_digest',
    'Your Daily News Digest - {{date}}',
    'Hi {{userName}},\n\nHere''s your personalized news digest for {{date}}:\n\n{{articles}}\n\nHappy reading!',
    '<h2>Your Daily News Digest</h2><p>{{date}}</p><div>{{articles}}</div>',
    ARRAY['userName', 'date', 'articles']
),
(
    'article_recommendation',
    'article_recommendation',
    'We think you''ll enjoy this: {{title}}',
    'Hi {{userName}},\n\nBased on your reading history, we think you''ll enjoy:\n\n{{articleTitle}}\n\n{{summary}}\n\nRead more: {{url}}',
    '<h2>{{articleTitle}}</h2><p>{{summary}}</p><a href="{{url}}">Read more</a>',
    ARRAY['userName', 'articleTitle', 'summary', 'url']
);

-- Comments
COMMENT ON TABLE notifications IS 'In-app notifications displayed in the notification hub';
COMMENT ON TABLE push_subscriptions IS 'Web push notification subscriptions for users';
COMMENT ON TABLE notification_preferences IS 'User notification preferences and settings';
COMMENT ON TABLE notification_logs IS 'Audit log of all notifications sent across all channels';
COMMENT ON TABLE notification_templates IS 'Email and notification templates';
