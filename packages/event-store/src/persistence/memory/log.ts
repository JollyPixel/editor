// Import Internal Dependencies
import type {
  AppendInput,
  CompactOptions,
  CompactReport,
  Event,
  ListAllOptions,
  ListFromCheckpointsOptions
} from "../../EventStore.ts";
import {
  EventLogClosedError,
  type EventLog
} from "../EventLog.ts";
import {
  materializeEvent,
  toJson,
  type EventFields
} from "../serialize.ts";

type EventPredicate = (
  event: Event
) => boolean;

export class MemoryEventLog implements EventLog {
  #events: Event[] = [];
  #streams = new Map<string, Event[]>();
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

    const fields: EventFields = {
      eventId: this.#nextEventId,
      assetType,
      assetId,
      eventType,
      eventDataJson: toJson(eventData, "eventData"),
      eventVersion: (this.#versionByAsset.get(assetId) ?? 0) + 1,
      actorJson: toJson(actor, "actor"),
      createdAt: new Date().toISOString()
    };

    this.#nextEventId++;
    this.#versionByAsset.set(assetId, fields.eventVersion);

    const stored = materializeEvent(fields);
    this.#events.push(stored);
    this.#stream(assetId).push(stored);

    return materializeEvent(fields);
  }

  list(
    assetId: string,
    fromVersion = 0
  ): Event[] {
    this.#assertOpen();

    return copyMatching(
      this.#streams.get(assetId) ?? [],
      (event) => event.eventVersion > fromVersion
    );
  }

  listFromCheckpoint(
    assetId: string,
    checkpointEventTypes: readonly string[]
  ): Event[] {
    this.#assertOpen();

    const stream = this.#streams.get(assetId) ?? [];
    const wanted = new Set(checkpointEventTypes);
    let start = 0;
    for (let index = stream.length - 1; index >= 0; index--) {
      if (wanted.has(stream[index].eventType)) {
        start = index;
        break;
      }
    }

    return stream
      .slice(start)
      .map((event) => structuredClone(event));
  }

  listAll(
    options: ListAllOptions = {}
  ): Event[] {
    this.#assertOpen();

    const {
      fromEventId = 0,
      eventTypePrefix,
      limit
    } = options;

    return copyMatching(
      this.#events,
      (event) => event.eventId > fromEventId &&
        matchesPrefix(event.eventType, eventTypePrefix),
      limit
    );
  }

  listFromCheckpoints(
    options: ListFromCheckpointsOptions
  ): Event[] {
    this.#assertOpen();

    const {
      checkpointEventTypes,
      eventTypePrefix
    } = options;
    const checkpoints = this.#checkpoints(checkpointEventTypes);

    return copyMatching(
      this.#events,
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
    this.#reindex();

    return {
      removed: before - this.#events.length,
      assets: checkpoints.size
    };
  }

  close(): void {
    this.#events = [];
    this.#streams.clear();
    this.#versionByAsset.clear();
    this.#nextEventId = 1;
    this.#closed = true;
  }

  #stream(
    assetId: string
  ): Event[] {
    let stream = this.#streams.get(assetId);
    if (stream === undefined) {
      stream = [];
      this.#streams.set(assetId, stream);
    }

    return stream;
  }

  #reindex(): void {
    this.#streams.clear();
    for (const event of this.#events) {
      this.#stream(event.assetId).push(event);
    }
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
      throw new EventLogClosedError();
    }
  }
}

function copyMatching(
  source: readonly Event[],
  matches: EventPredicate,
  limit?: number
): Event[] {
  const events: Event[] = [];
  const max = limit ?? Infinity;

  for (const event of source) {
    if (events.length >= max) {
      break;
    }
    if (matches(event)) {
      events.push(structuredClone(event));
    }
  }

  return events;
}

function matchesPrefix(
  eventType: string,
  prefix: string | undefined
): boolean {
  return prefix === undefined || eventType.startsWith(prefix);
}
