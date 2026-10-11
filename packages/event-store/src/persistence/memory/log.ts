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
import { EventLogClosedError } from "../errors/EventLogClosedError.ts";
import { EventRecord } from "../EventRecord.ts";
import { EventVersionConflictError } from "../errors/EventVersionConflictError.ts";
import { MemoryTagTable } from "./tags.ts";

type EventPredicate = (
  event: Event
) => boolean;

export class MemoryEventLog implements EventLog {
  #events: Event[] = [];
  #streams = new Map<string, Event[]>();
  #nextEventId = 1;
  #versionByAsset = new Map<string, number>();
  #closed = false;
  readonly tags = new MemoryTagTable(
    (assetId, eventVersion) => this.#find(assetId, eventVersion) !== undefined
  );

  insert(
    input: AppendInput
  ): Event {
    this.#assertOpen();

    const { assetId, expectedVersion } = input;

    const head = this.#versionByAsset.get(assetId) ?? 0;
    if (expectedVersion !== undefined && expectedVersion !== head) {
      throw new EventVersionConflictError(
        assetId,
        expectedVersion,
        head
      );
    }

    const record = EventRecord.encode(input);
    const position = {
      eventId: this.#nextEventId,
      eventVersion: head + 1
    };

    this.#nextEventId++;
    this.#versionByAsset.set(assetId, position.eventVersion);

    const stored = record.toEvent(position);
    this.#events.push(stored);
    this.#stream(assetId).push(stored);

    return record.toEvent(position);
  }

  get(
    assetId: string,
    eventVersion: number
  ): Event | undefined {
    this.#assertOpen();

    const event = this.#find(assetId, eventVersion);

    return event === undefined ? undefined : structuredClone(event);
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
      eventTypePrefix,
      assetId
    } = options;
    const heads = this.#checkpointHeads(checkpointEventTypes, assetId);

    return copyMatching(
      this.#scope(assetId),
      (event) => event.eventId >= (heads.get(event.assetId) ?? 0) &&
        matchesPrefix(event.eventType, eventTypePrefix)
    );
  }

  compact(
    options: CompactOptions
  ): CompactReport {
    this.#assertOpen();

    const heads = this.#checkpointHeads(
      options.checkpointEventTypes,
      options.assetId
    );
    const tagged = this.tags.versionsByAsset();
    const before = this.#events.length;

    this.#events = this.#events.filter(
      (event) => event.eventId >= (heads.get(event.assetId) ?? 0) ||
        tagged.get(event.assetId)?.has(event.eventVersion) === true
    );
    this.#reindex();

    return {
      removed: before - this.#events.length,
      assets: heads.size
    };
  }

  close(): void {
    this.#events = [];
    this.#streams.clear();
    this.tags.close();
    this.#versionByAsset.clear();
    this.#nextEventId = 1;
    this.#closed = true;
  }

  #find(
    assetId: string,
    eventVersion: number
  ): Event | undefined {
    return this.#streams.get(assetId)?.find(
      (event) => event.eventVersion === eventVersion
    );
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

  #scope(
    assetId: string | undefined
  ): readonly Event[] {
    return assetId === undefined ?
      this.#events :
      this.#streams.get(assetId) ?? [];
  }

  #checkpointHeads(
    eventTypes: readonly string[],
    assetId: string | undefined
  ): Map<string, number> {
    const wanted = new Set(eventTypes);
    const heads = new Map<string, number>();
    if (wanted.size === 0) {
      return heads;
    }

    const events = this.#scope(assetId);
    for (let index = events.length - 1; index >= 0; index--) {
      const event = events[index];
      if (!wanted.has(event.eventType) || heads.has(event.assetId)) {
        continue;
      }

      heads.set(event.assetId, event.eventId);
      if (assetId !== undefined) {
        break;
      }
    }

    return heads;
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
