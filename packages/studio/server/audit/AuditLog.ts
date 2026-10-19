// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import type { AccountActivity } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import type {
  AuditEntry,
  AuditItem,
  SettingsChange
} from "./AuditEntry.ts";
import { EventPages } from "./EventPages.ts";

// CONSTANTS
export const AUDIT_DATABASE_FILE = "audit.db";
export const AUDIT_STATE_IGNORES = [
  AUDIT_DATABASE_FILE,
  `${AUDIT_DATABASE_FILE}-journal`,
  `${AUDIT_DATABASE_FILE}-wal`,
  `${AUDIT_DATABASE_FILE}-shm`
];
export const SETTINGS_CHANGED = "settings.changed";
const kAccountEventPrefix = "account.";

export type AuditEventDataMap = {
  [SETTINGS_CHANGED]: SettingsChange;
} & {
  [K in `${typeof kAccountEventPrefix}${AccountActivity["type"]}`]: AccountActivity;
};

type AuditEvent = EventStore.TypedEvent<AuditEventDataMap>;

export class AuditLog implements Disposable {
  static async open(
    location: string | null
  ): Promise<AuditLog> {
    return new AuditLog(
      location === null ?
        EventStore.persistence.memory<AuditEventDataMap>() :
        await EventStore.persistence.sqlite<AuditEventDataMap>(location)
    );
  }

  readonly store: EventStore.TypedEventStore<AuditEventDataMap>;

  constructor(
    store: EventStore.TypedEventStore<AuditEventDataMap>
  ) {
    this.store = store;
  }

  recordSettings(
    actorId: string,
    change: SettingsChange
  ): void {
    this.store.writer.append({
      assetType: "settings",
      assetId: change.section,
      eventType: SETTINGS_CHANGED,
      eventData: change,
      actor: {
        type: "user",
        id: actorId
      }
    }).unwrap();
  }

  recordAccount(
    activity: AccountActivity
  ): void {
    const isLink = "linkId" in activity;

    this.store.writer.append({
      assetType: isLink ? "share-link" : "account",
      assetId: isLink ? activity.linkId : activity.accountId,
      eventType: `${kAccountEventPrefix}${activity.type}`,
      eventData: activity,
      actor: {
        type: "user",
        id: activity.actorId
      }
    }).unwrap();
  }

  * newestFirst(
    before: number | undefined
  ): IterableIterator<AuditItem> {
    for (const event of new EventPages(this.store, before)) {
      yield {
        position: event.eventId,
        at: Date.parse(event.createdAt),
        entry: isAuditEvent(event) ? auditEntry(event) : null
      };
    }
  }

  [Symbol.dispose](): void {
    this.store.close();
  }
}

function isAuditEvent(
  event: EventStore.Event
): event is AuditEvent {
  return event.eventType === SETTINGS_CHANGED ||
    event.eventType.startsWith(kAccountEventPrefix);
}

function auditEntry(
  event: AuditEvent
): AuditEntry {
  const at = Date.parse(event.createdAt);

  return event.eventType === SETTINGS_CHANGED ?
    {
      kind: "settings",
      at,
      actor: event.actor,
      change: event.eventData
    } :
    {
      kind: "account",
      at,
      actor: event.actor,
      activity: event.eventData
    };
}
