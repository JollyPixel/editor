// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// CONSTANTS
const kSystemActor: EventStore.Actor = {
  type: "system",
  source: "test"
};

let nextEventId = 1;

export function assetEvent(
  eventType: string,
  eventData: unknown,
  overrides: Partial<EventStore.Event> = {}
): EventStore.Event {
  return {
    eventId: nextEventId++,
    assetType: "binary",
    assetId: "a1",
    eventType,
    eventData,
    eventVersion: 1,
    actor: kSystemActor,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}
