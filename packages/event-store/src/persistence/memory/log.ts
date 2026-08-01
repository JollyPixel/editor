// Import Internal Dependencies
import type {
  AppendInput,
  Event
} from "../../EventStore.ts";

export class MemoryEventLog {
  #events: Event[] = [];
  #nextEventId = 1;
  #versionByAsset = new Map<string, number>();

  insert(
    input: AppendInput
  ): Event {
    const { assetType, assetId, eventType, eventData } = input;
    const eventVersion = (this.#versionByAsset.get(assetId) ?? 0) + 1;
    this.#versionByAsset.set(assetId, eventVersion);

    const event: Event = {
      eventId: this.#nextEventId++,
      assetType,
      assetId,
      eventType,
      eventData: structuredClone(eventData),
      eventVersion,
      createdAt: new Date().toISOString()
    };
    this.#events.push(event);

    return structuredClone(event);
  }

  select(
    assetId: string,
    fromVersion: number
  ): Event[] {
    return this.#events
      .filter((event) => event.assetId === assetId && event.eventVersion > fromVersion)
      .sort((a, b) => a.eventVersion - b.eventVersion)
      .map((event) => structuredClone(event));
  }

  clear(): void {
    this.#events = [];
  }
}
