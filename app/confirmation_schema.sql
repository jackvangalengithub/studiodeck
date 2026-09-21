-- Confirmation details extend the existing immutable comment text and thread.
CREATE TABLE IF NOT EXISTS comment_confirmations (
 comment_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
 recipient TEXT NOT NULL,
 recipient_name TEXT NOT NULL,
 amount_cents INTEGER,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','withdrawn')),
 decided_by TEXT,
 decided_at TEXT
);
CREATE TABLE IF NOT EXISTS comment_attachments (
 comment_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
 version_id TEXT NOT NULL REFERENCES file_versions(id)
);
CREATE TABLE IF NOT EXISTS confirmation_budget_links (
 budget_item_id TEXT PRIMARY KEY REFERENCES budget_items(id) ON DELETE CASCADE,
 comment_id TEXT NOT NULL REFERENCES comment_confirmations(comment_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_confirmation_budget_comment ON confirmation_budget_links(comment_id);

-- Named conversations are ordinary comment roots, preserving replies and notifications.
CREATE TABLE IF NOT EXISTS communication_threads (
 comment_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
 title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_grants (
 id TEXT PRIMARY KEY,
 root_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
 email TEXT NOT NULL,
 name TEXT NOT NULL,
 invited_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked INTEGER NOT NULL DEFAULT 0,
 UNIQUE(root_id,email)
);
CREATE INDEX IF NOT EXISTS idx_conversation_grants_email ON conversation_grants(email);
CREATE TABLE IF NOT EXISTS conversation_login_grants (
 token_hash TEXT PRIMARY KEY REFERENCES login_tokens(token_hash) ON DELETE CASCADE,
 grant_id TEXT NOT NULL REFERENCES conversation_grants(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS conversation_outbox (
 id TEXT PRIMARY KEY,
 comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
 grant_id TEXT NOT NULL REFERENCES conversation_grants(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'queued',
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT 0,
 error TEXT NOT NULL DEFAULT '',
 UNIQUE(comment_id,grant_id)
);
