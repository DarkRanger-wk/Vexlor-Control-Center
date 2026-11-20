CREATE TABLE IF NOT EXISTS ticket_identities (
  install_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  ticket_number INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  install_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bug', 'technical', 'question', 'feedback', 'other')),
  subject TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  form_data TEXT NOT NULL DEFAULT '{}',
  assigned_admin_id TEXT,
  user_unread INTEGER NOT NULL DEFAULT 0,
  team_unread INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,
  FOREIGN KEY (install_id) REFERENCES ticket_identities(install_id),
  FOREIGN KEY (assigned_admin_id) REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_number INTEGER NOT NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'team')),
  author_id TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0 CHECK (is_internal IN (0, 1)),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (ticket_number) REFERENCES tickets(ticket_number) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id TEXT PRIMARY KEY,
  ticket_number INTEGER NOT NULL,
  message_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  content BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (ticket_number) REFERENCES tickets(ticket_number) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES ticket_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tickets_install_activity_idx ON tickets(install_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS tickets_status_activity_idx ON tickets(status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS tickets_assignment_activity_idx ON tickets(assigned_admin_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS ticket_messages_thread_idx ON ticket_messages(ticket_number, created_at);
CREATE INDEX IF NOT EXISTS ticket_attachments_message_idx ON ticket_attachments(message_id);
