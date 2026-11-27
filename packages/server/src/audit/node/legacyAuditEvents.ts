// Import Node.js Dependencies
import type { DatabaseSync } from "node:sqlite";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { AccountActivity } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import {
  accountEntry,
  settingsEntry,
  type AuditEntry,
  type SettingsChange
} from "./AuditEntry.ts";

// CONSTANTS
const kSettingsChanged = "settings.changed";
const kAccountEventPrefix = "account.";

interface LegacyEvent {
  event_type: string;
  event_data: string;
  actor: string;
  created_at: string;
}

export function migrateLegacyEvents(
  db: DatabaseSync,
  record: (entry: AuditEntry) => void
): void {
  const legacy = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'events'"
  ).get();
  if (legacy === undefined) {
    return;
  }

  const events = db.prepare(`
    SELECT event_type, event_data, actor, created_at
    FROM events
    ORDER BY event_id
  `).all() as unknown as LegacyEvent[];
  for (const event of events) {
    const entry = legacyEntry(event);
    if (entry !== null) {
      record(entry);
    }
  }
  db.exec("DROP TABLE events; DROP TABLE IF EXISTS tags;");
}

function legacyEntry(
  event: LegacyEvent
): AuditEntry | null {
  const at = Date.parse(event.created_at);
  const data: unknown = JSON.parse(event.event_data);
  if (event.event_type === kSettingsChanged) {
    return settingsEntry(
      JSON.parse(event.actor) as EventStore.Actor,
      data as SettingsChange,
      at
    );
  }
  if (event.event_type.startsWith(kAccountEventPrefix)) {
    return accountEntry(data as AccountActivity, at);
  }

  return null;
}
