export const SQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_type TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (asset_id, event_version)
);
CREATE INDEX IF NOT EXISTS idx_events_asset ON events (asset_id, event_version);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type, event_id);
`;
