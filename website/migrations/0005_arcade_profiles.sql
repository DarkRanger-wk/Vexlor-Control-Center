CREATE TABLE IF NOT EXISTS arcade_profiles (
  install_id TEXT PRIMARY KEY,
  profile_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (install_id) REFERENCES ticket_identities(install_id) ON DELETE CASCADE
);
