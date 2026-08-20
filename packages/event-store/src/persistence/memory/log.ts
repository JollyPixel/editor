// Import Internal Dependencies
import type {
  AppendInput,
  Event,
  ListAllOptions
} from "../../EventStore.ts";
import type { EventLog } from "../EventLog.ts";
import { toStoredValue } from "../serialize.ts";

type EventPredicate = (
  event: Event
) => boolean;

export class MemoryEventLog implements EventLog {
  #events: Event[] = [];
  #nextEventId = 1;
  #versionByAsset = new Map<string, number>();
  #closed = false;

  insert(
    input: AppendInput
  ): Event {
    this.#assertOpen();

    const {
      assetType,
      assetId,
      eventType,
      eventData,
      actor
    } = input;

    const event: Event = {
      eventId: this.#nextEventId,
      assetType,
      assetId,
      eventType,
      eventData: toStoredValue(eventData, "eventData"),
      eventVersion: (this.#versionByAsset.get(assetId) ?? 0) + 1,
      actor: toStoredValue(actor, "actor"),
      createdAt: new Date().toISOString()
    };

    this.#nextEventId++;
    this.#versionByAsset.set(
      assetId,
      event.eventVersion
    );
    this.#events.push(structuredClone(event));

    return event;
  }

  list(
    assetId: string,
    fromVersion = 0
  ): Event[] {
    return this.#read(
      (event) => event.assetId === assetId && event.eventVersion > fromVersion
    );
  }

  listAll(
    options: ListAllOptions = {}
  ): Event[] {
    const {
      fromEventId = 0,
      eventTypePrefix,
      limit
    } = options;

    return this.#read(
      (event) => event.eventId > fromEventId &&
        matchesPrefix(event.eventType, eventTypePrefix),
      limit
    );
  }

  close(): void {
    this.#events = [];
    this.#versionByAsset.clear();
    this.#nextEventId = 1;
    this.#closed = true;
  }

  #read(
    matches: EventPredicate,
    limit?: number
  ): Event[] {
    this.#assertOpen();

    const events = this.#events.filter(matches);

    return (limit === undefined ? events : events.slice(0, limit))
      .map((event) => structuredClone(event));
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error("event log is closed");
    }
  }
}

function matchesPrefix(
  eventType: string,
  prefix: string | undefined
): boolean {
  return prefix === undefined || eventType.startsWith(prefix);
}
