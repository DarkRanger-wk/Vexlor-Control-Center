CREATE TABLE IF NOT EXISTS installations (
  install_id TEXT PRIMARY KEY,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  app_version TEXT NOT NULL,
  platform TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_heartbeat_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (install_id) REFERENCES installations (install_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS installations_last_seen_idx ON installations (last_seen_at);
CREATE INDEX IF NOT EXISTS sessions_started_idx ON sessions (started_at);
CREATE INDEX IF NOT EXISTS sessions_install_idx ON sessions (install_id);
CREATE INDEX IF NOT EXISTS sessions_active_idx ON sessions (ended_at, last_heartbeat_at);
CREATE INDEX IF NOT EXISTS events_received_idx ON events (received_at);
