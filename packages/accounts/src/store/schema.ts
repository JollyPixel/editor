// Import Internal Dependencies
import { ADMIN_ROLE } from "../account/Account.ts";

export const SQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  digest BLOB NOT NULL,
  salt BLOB NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'pending')),
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash BLOB PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS ownership (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT
) STRICT;

INSERT OR IGNORE INTO ownership (singleton, user_id)
  SELECT 1, id FROM users
  WHERE role = '${ADMIN_ROLE}' AND status = 'active'
  ORDER BY created_at, rowid
  LIMIT 1;

CREATE TABLE IF NOT EXISTS avatars (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  bytes BLOB NOT NULL
) STRICT;
`;
