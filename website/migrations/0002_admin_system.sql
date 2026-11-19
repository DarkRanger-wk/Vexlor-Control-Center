CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  install_id TEXT UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  premium_until INTEGER,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  role_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  PRIMARY KEY (role_id, permission),
  FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role_id TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (role_id) REFERENCES admin_roles(id)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  admin_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,
  revoked_at INTEGER,
  ip_hash TEXT,
  user_agent_hash TEXT,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS redeem_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  code_hint TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value TEXT,
  description TEXT,
  secret INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at INTEGER,
  max_redemptions INTEGER NOT NULL DEFAULT 1,
  current_redemptions INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS code_redemptions (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL,
  user_id TEXT,
  install_id TEXT,
  reward_type TEXT NOT NULL,
  reward_value TEXT,
  redeemed_at INTEGER NOT NULL,
  FOREIGN KEY (code_id) REFERENCES redeem_codes(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS code_redemptions_unique_user
  ON code_redemptions(code_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS code_redemptions_unique_install
  ON code_redemptions(code_id, install_id) WHERE install_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS code_rewards (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value TEXT,
  FOREIGN KEY (code_id) REFERENCES redeem_codes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS premium_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at INTEGER NOT NULL,
  expires_at INTEGER,
  source TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',
  active INTEGER NOT NULL DEFAULT 1,
  starts_at INTEGER,
  expires_at INTEGER,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  beta INTEGER NOT NULL DEFAULT 0,
  config TEXT,
  updated_by TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS support_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  install_id TEXT,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  internal_notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bug_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  install_id TEXT,
  summary TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  install_id TEXT,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  result TEXT NOT NULL,
  details TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  event_type TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  details TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS telemetry_events (
  id TEXT PRIMARY KEY,
  install_id TEXT,
  event_type TEXT NOT NULL,
  properties TEXT,
  received_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS users_status_idx ON users(status);
CREATE INDEX IF NOT EXISTS users_premium_idx ON users(premium_until);
CREATE INDEX IF NOT EXISTS admin_sessions_admin_idx ON admin_sessions(admin_id, revoked_at);
CREATE INDEX IF NOT EXISTS redeem_codes_status_idx ON redeem_codes(status, expires_at);
CREATE INDEX IF NOT EXISTS premium_user_idx ON premium_subscriptions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS support_status_idx ON support_requests(status, priority);
CREATE INDEX IF NOT EXISTS audit_created_idx ON admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS security_created_idx ON security_events(created_at);
CREATE INDEX IF NOT EXISTS telemetry_received_idx ON telemetry_events(received_at);

INSERT OR IGNORE INTO admin_roles (id, name, description, created_at) VALUES
  ('super_admin', 'Super Administrator', 'Vollzugriff auf die Vexlor-Verwaltung', unixepoch()),
  ('admin', 'Administrator', 'Verwaltung von Benutzern, Codes, Support und Ankündigungen', unixepoch()),
  ('moderator', 'Moderator', 'Support und Fehlerberichte mit eingeschränkten Rechten', unixepoch());

INSERT OR IGNORE INTO admin_permissions (role_id, permission) VALUES
  ('super_admin', '*'),
  ('admin', 'users.read'), ('admin', 'users.manage'), ('admin', 'codes.manage'),
  ('admin', 'premium.manage'), ('admin', 'announcements.manage'), ('admin', 'support.manage'),
  ('admin', 'features.manage'), ('admin', 'stats.read'), ('admin', 'audit.read'),
  ('moderator', 'support.manage'), ('moderator', 'support.read'), ('moderator', 'users.read'), ('moderator', 'stats.read');
