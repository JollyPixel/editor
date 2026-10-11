// Import Internal Dependencies
import type {
  EventTag,
  EventTagInput
} from "../../EventStore.ts";
import type { TagLog } from "../EventLog.ts";
import { TagRecord } from "../TagRecord.ts";
import { EventLogClosedError } from "../errors/EventLogClosedError.ts";
import { EventTagConflictError } from "../errors/EventTagConflictError.ts";
import { UnknownEventError } from "../errors/UnknownEventError.ts";

export type EventLookup = (
  assetId: string,
  eventVersion: number
) => boolean;

export class MemoryTagTable implements TagLog {
  #tags = new Map<string, EventTag>();
  #holds: EventLookup;
  #closed = false;

  constructor(
    holds: EventLookup
  ) {
    this.#holds = holds;
  }

  insert(
    input: EventTagInput
  ): EventTag {
    this.#assertOpen();

    const record = TagRecord.encode(input);
    if (!this.#holds(record.assetId, record.eventVersion)) {
      throw new UnknownEventError(record.assetId, record.eventVersion);
    }

    const key = tagKey(record.assetId, record.name);
    if (this.#tags.has(key)) {
      throw new EventTagConflictError(record.assetId, record.name);
    }
    this.#tags.set(key, record.toEventTag());

    return record.toEventTag();
  }

  get(
    assetId: string,
    name: string
  ): EventTag | undefined {
    this.#assertOpen();

    const tag = this.#tags.get(tagKey(assetId, name));

    return tag === undefined ? undefined : structuredClone(tag);
  }

  list(
    assetId?: string
  ): EventTag[] {
    this.#assertOpen();

    const tags: EventTag[] = [];
    for (const tag of this.#tags.values()) {
      if (assetId === undefined || tag.assetId === assetId) {
        tags.push(structuredClone(tag));
      }
    }

    return tags;
  }

  delete(
    assetId: string,
    name: string
  ): boolean {
    this.#assertOpen();

    return this.#tags.delete(tagKey(assetId, name));
  }

  versionsByAsset(): Map<string, Set<number>> {
    const versions = new Map<string, Set<number>>();
    for (const tag of this.#tags.values()) {
      let tagged = versions.get(tag.assetId);
      if (tagged === undefined) {
        tagged = new Set();
        versions.set(tag.assetId, tagged);
      }
      tagged.add(tag.eventVersion);
    }

    return versions;
  }

  close(): void {
    this.#tags.clear();
    this.#closed = true;
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new EventLogClosedError();
    }
  }
}

function tagKey(
  assetId: string,
  name: string
): string {
  return JSON.stringify([assetId, name]);
}
