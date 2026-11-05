CREATE TABLE IF NOT EXISTS usernames (
  username TEXT PRIMARY KEY,
  firebase_uid TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS username_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firebase_uid TEXT NOT NULL,
  attempted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_username_attempts_uid
  ON username_attempts (firebase_uid, attempted_at);
