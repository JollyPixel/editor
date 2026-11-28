// CONSTANTS
export const SCHEMA_VERSION = 2;

export const SQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  digest BLOB NOT NULL,
  salt BLOB NOT NULL,
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

CREATE TABLE IF NOT EXISTS memberships (
  realm_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'pending')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (realm_id, user_id)
) STRICT;

CREATE INDEX IF NOT EXISTS memberships_by_user ON memberships (user_id);

CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  realm_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  asset_id TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
) STRICT;

CREATE INDEX IF NOT EXISTS share_links_by_realm ON share_links (realm_id);
CREATE INDEX IF NOT EXISTS share_links_by_creator ON share_links (created_by);

CREATE TABLE IF NOT EXISTS agent_tokens (
  id TEXT PRIMARY KEY,
  realm_id TEXT NOT NULL,
  token_hash BLOB NOT NULL UNIQUE,
  owner_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
) STRICT;

CREATE INDEX IF NOT EXISTS agent_tokens_by_owner ON agent_tokens (owner_id);

CREATE TABLE IF NOT EXISTS agent_avatars (
  token_id TEXT PRIMARY KEY REFERENCES agent_tokens (id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  bytes BLOB NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS avatars (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  bytes BLOB NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS preferences (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  overrides TEXT NOT NULL,
  PRIMARY KEY (user_id, scope)
) STRICT;

PRAGMA user_version = ${SCHEMA_VERSION};
`;
