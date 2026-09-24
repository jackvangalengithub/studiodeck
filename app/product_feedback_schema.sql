CREATE TABLE IF NOT EXISTS product_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    studio_id TEXT REFERENCES studios(id) ON DELETE SET NULL,
    request_key TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('broken','friction','missing','positive','other')),
    area TEXT NOT NULL,
    goal TEXT NOT NULL,
    detail TEXT NOT NULL,
    impact TEXT NOT NULL CHECK(impact IN ('','minor','slows','blocked')),
    frequency TEXT NOT NULL CHECK(frequency IN ('first','sometimes','often')),
    contact_allowed INTEGER NOT NULL DEFAULT 0 CHECK(contact_allowed IN (0,1)),
    screen TEXT NOT NULL,
    app_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','clarification','planned','shipped','not_pursuing')),
    theme TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id,request_key)
);
CREATE INDEX IF NOT EXISTS product_feedback_queue ON product_feedback(status,created_at);
CREATE INDEX IF NOT EXISTS product_feedback_theme ON product_feedback(theme);
CREATE TABLE IF NOT EXISTS product_feedback_images (
    feedback_id TEXT PRIMARY KEY REFERENCES product_feedback(id) ON DELETE CASCADE,
    data BLOB NOT NULL,
    mime TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_feedback_outbox (
    feedback_id TEXT PRIMARY KEY REFERENCES product_feedback(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','logged','failed','cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt INTEGER NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS product_feedback_mail_queue ON product_feedback_outbox(status,next_attempt);
