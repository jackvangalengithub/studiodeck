CREATE TABLE IF NOT EXISTS websites (
 studio_id TEXT PRIMARY KEY REFERENCES studios(id), draft TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 subscription_id TEXT UNIQUE, subscription_status TEXT NOT NULL DEFAULT 'none', paid_until INTEGER NOT NULL DEFAULT 0,
 domain TEXT NOT NULL DEFAULT '', domain_token TEXT NOT NULL, domain_verified INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL
);
-- Deliberately no project/file foreign keys: public copies survive source deletion.
CREATE TABLE IF NOT EXISTS website_assets (
 id TEXT PRIMARY KEY, studio_id TEXT NOT NULL REFERENCES websites(studio_id), mime TEXT NOT NULL,
 data BLOB NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, fingerprint TEXT NOT NULL,
 UNIQUE(studio_id,fingerprint)
);
CREATE TABLE IF NOT EXISTS website_history (
 id TEXT PRIMARY KEY, studio_id TEXT NOT NULL REFERENCES websites(studio_id), draft TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS website_ai_usage (
 studio_id TEXT NOT NULL REFERENCES websites(studio_id), month TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(studio_id,month)
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_pending_website ON billing_orders(studio_id) WHERE kind='website' AND status='pending';
