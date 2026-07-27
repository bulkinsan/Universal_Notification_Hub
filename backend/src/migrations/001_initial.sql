-- Migration 001_initial: create core tables
-- Up

CREATE TABLE IF NOT EXISTS traffic_sources (
    id TEXT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    domain VARCHAR(255) NOT NULL UNIQUE,
    api_key_hash VARCHAR(255) NOT NULL,
    logo_path VARCHAR(255),
    description TEXT,
    website_url VARCHAR(255),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    device_type VARCHAR(20) NOT NULL DEFAULT 'pwa',
    push_subscription TEXT,
    ws_connection_id VARCHAR(255),
    device_token VARCHAR(255),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    source_id TEXT NOT NULL REFERENCES traffic_sources(id),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, source_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES traffic_sources(id),
    title VARCHAR(255) NOT NULL,
    body TEXT,
    icon_url VARCHAR(512),
    data TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL REFERENCES notifications(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    sent_at DATETIME,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_source ON user_subscriptions(source_id);
CREATE INDEX IF NOT EXISTS idx_notifications_source ON notifications(source_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification ON notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user ON notification_deliveries(user_id);
