// Import Internal Dependencies
import type {
  AppendInput,
  CompactOptions,
  CompactReport,
  Event,
  ListAllOptions,
  ListFromCheckpointsOptions
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

  lastVersionOf(
    assetId: string,
    eventTypes: readonly string[]
  ): number {
    this.#assertOpen();

    const wanted = new Set(eventTypes);
    let version = 0;
    for (const event of this.#events) {
      if (
        event.assetId === assetId &&
        wanted.has(event.eventType) &&
        event.eventVersion > version
      ) {
        version = event.eventVersion;
      }
    }

    return version;
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

  listFromCheckpoints(
    options: ListFromCheckpointsOptions
  ): Event[] {
    const {
      checkpointEventTypes,
      eventTypePrefix
    } = options;
    const checkpoints = this.#checkpoints(checkpointEventTypes);

    return this.#read(
      (event) => event.eventId >= (checkpoints.get(event.assetId) ?? 0) &&
        matchesPrefix(event.eventType, eventTypePrefix)
    );
  }

  compact(
    options: CompactOptions
  ): CompactReport {
    this.#assertOpen();

    const checkpoints = this.#checkpoints(options.checkpointEventTypes);
    const before = this.#events.length;
    this.#events = this.#events.filter(
      (event) => event.eventId >= (checkpoints.get(event.assetId) ?? 0)
    );

    return {
      removed: before - this.#events.length,
      assets: checkpoints.size
    };
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

  #checkpoints(
    eventTypes: readonly string[]
  ): Map<string, number> {
    const wanted = new Set(eventTypes);
    const checkpoints = new Map<string, number>();
    if (wanted.size === 0) {
      return checkpoints;
    }

    for (const event of this.#events) {
      if (
        wanted.has(event.eventType) &&
        event.eventId > (checkpoints.get(event.assetId) ?? 0)
      ) {
        checkpoints.set(event.assetId, event.eventId);
      }
    }

    return checkpoints;
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
