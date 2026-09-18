CREATE TABLE IF NOT EXISTS studio_billing (
 studio_id TEXT PRIMARY KEY REFERENCES studios(id), customer_id TEXT UNIQUE, customer_parameters TEXT, subscription_id TEXT UNIQUE,
 origin_user_id TEXT REFERENCES users(id), onboarded_at INTEGER, trial_started_at INTEGER, trial_ends_at INTEGER, trial_project_used INTEGER NOT NULL DEFAULT 0,
 legacy_exempt INTEGER NOT NULL DEFAULT 0, plan TEXT, subscription_status TEXT NOT NULL DEFAULT 'none',
 paid_until INTEGER NOT NULL DEFAULT 0, cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
 extra_projects INTEGER NOT NULL DEFAULT 0, extra_seats INTEGER NOT NULL DEFAULT 0,
 subscription_json TEXT NOT NULL DEFAULT '{}', synced_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS billing_trials (user_id TEXT PRIMARY KEY REFERENCES users(id),studio_id TEXT NOT NULL,started_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS project_coverage (
 project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
 source TEXT NOT NULL CHECK(source IN ('trial','project_pass','subscription','legacy','none')),
 designer_id TEXT REFERENCES users(id), restricted_at INTEGER, retention_notified_at INTEGER
);
CREATE TABLE IF NOT EXISTS billing_orders (
 id TEXT PRIMARY KEY,studio_id TEXT NOT NULL REFERENCES studios(id),project_id TEXT,actor_id TEXT NOT NULL,
 kind TEXT NOT NULL,plan TEXT NOT NULL,price_id TEXT NOT NULL,checkout_id TEXT UNIQUE,checkout_url TEXT,
 payment_id TEXT UNIQUE,invoice_id TEXT,status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,
 paid_at INTEGER,expires_at INTEGER NOT NULL,parameters TEXT NOT NULL DEFAULT '{}',error TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_pending_subscription ON billing_orders(studio_id) WHERE kind='subscription' AND status='pending';
CREATE UNIQUE INDEX IF NOT EXISTS billing_pending_pass ON billing_orders(project_id) WHERE kind IN ('pass','extension') AND status='pending';
CREATE UNIQUE INDEX IF NOT EXISTS billing_pending_prepaid_pass ON billing_orders(studio_id) WHERE kind='pass' AND project_id IS NULL AND status='pending';
CREATE TABLE IF NOT EXISTS project_access_grants (
 order_id TEXT PRIMARY KEY REFERENCES billing_orders(id),project_id TEXT NOT NULL,
 paid_at INTEGER NOT NULL,days INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS stripe_events (
 id TEXT PRIMARY KEY,type TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',received_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_notices (
 notice_key TEXT PRIMARY KEY,studio_id TEXT NOT NULL,email TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS billing_usage (project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,kind TEXT NOT NULL,window TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project_id,kind,window));
CREATE TABLE IF NOT EXISTS billing_changes (id TEXT PRIMARY KEY,studio_id TEXT NOT NULL REFERENCES studios(id),subscription_id TEXT NOT NULL,plan TEXT NOT NULL,extra_projects INTEGER NOT NULL,extra_seats INTEGER NOT NULL,parameters TEXT NOT NULL,snapshot TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,proration_at INTEGER NOT NULL,created_at INTEGER NOT NULL,effective_at INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'preview',schedule_id TEXT,invoice_url TEXT);
