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

-- Audience is explicit for new threads. Existing slide conversations remain shared.
CREATE TABLE IF NOT EXISTS communication_audiences (
 root_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
 audience TEXT NOT NULL CHECK(audience IN ('studio','shared'))
);
CREATE TABLE IF NOT EXISTS checklist_threads (
 iteration_id TEXT NOT NULL,
 question_id TEXT NOT NULL,
 root_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
 PRIMARY KEY(iteration_id,question_id),
 FOREIGN KEY(iteration_id,question_id) REFERENCES open_questions(iteration_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_checklist_threads_root ON checklist_threads(root_id);

-- A message keeps its type and optional work assignment in the same conversation.
CREATE TABLE IF NOT EXISTS communication_messages (
 comment_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
 type TEXT NOT NULL CHECK(type IN ('message','question','todo','confirmation','price_adjustment')),
 assignee TEXT NOT NULL DEFAULT '',
 assignee_name TEXT NOT NULL DEFAULT '',
 due_date TEXT NOT NULL DEFAULT '',
 question_id TEXT
);

-- Purpose belongs to the root subject. Replies have no type metadata.
CREATE TABLE IF NOT EXISTS communication_topics (
 root_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
 type TEXT NOT NULL CHECK(type IN ('conversation','todo','approval')),
 assignee TEXT NOT NULL DEFAULT '', assignee_name TEXT NOT NULL DEFAULT '',
 due_date TEXT NOT NULL DEFAULT '', question_id TEXT,
 related_root_id TEXT REFERENCES comments(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS communication_topic_history (
 id TEXT PRIMARY KEY, root_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
 actor TEXT NOT NULL, from_type TEXT NOT NULL, to_type TEXT NOT NULL,
 assignee_name TEXT NOT NULL DEFAULT '', due_date TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);

-- A guest-created linked thread cannot outlive its originating invitation.
CREATE TABLE IF NOT EXISTS conversation_grant_sources (
 grant_id TEXT PRIMARY KEY REFERENCES conversation_grants(id) ON DELETE CASCADE,
 source_grant_id TEXT NOT NULL REFERENCES conversation_grants(id) ON DELETE CASCADE
);
CREATE TRIGGER IF NOT EXISTS revoke_linked_conversation_grants
BEFORE DELETE ON conversation_grants BEGIN
 UPDATE conversation_grants SET revoked=1 WHERE id IN
  (SELECT grant_id FROM conversation_grant_sources WHERE source_grant_id=OLD.id);
END;
