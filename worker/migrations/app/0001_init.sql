CREATE TABLE IF NOT EXISTS shard_ranges (
  shard_binding TEXT PRIMARY KEY,
  database_name TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  bucket_end INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bucket_overrides (
  firebase_uid TEXT PRIMARY KEY,
  shard_binding TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  firebase_uid TEXT PRIMARY KEY,
  email TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO shard_ranges (shard_binding, database_name, bucket_start, bucket_end) VALUES
  ('USER_00', 'studyapp-user-00', 0, 8191),
  ('USER_01', 'studyapp-user-01', 8192, 16383),
  ('USER_02', 'studyapp-user-02', 16384, 24575),
  ('USER_03', 'studyapp-user-03', 24576, 32767),
  ('USER_04', 'studyapp-user-04', 32768, 40959),
  ('USER_05', 'studyapp-user-05', 40960, 49151),
  ('USER_06', 'studyapp-user-06', 49152, 57343),
  ('USER_07', 'studyapp-user-07', 57344, 65535);
