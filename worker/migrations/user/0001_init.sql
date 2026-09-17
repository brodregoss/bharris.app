CREATE TABLE IF NOT EXISTS users (
  firebase_uid TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  do_store_name TEXT,
  do_store_id TEXT,
  do_status TEXT NOT NULL DEFAULT 'pending',
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  ai_quota_used INTEGER NOT NULL DEFAULT 0,
  ai_quota_limit INTEGER NOT NULL DEFAULT 30,
  ai_quota_period TEXT,
  revenuecat_app_user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
