// Import Internal Dependencies
import * as EventStore from "#src/index.ts";

// CONSTANTS
export const USER_ACTOR: EventStore.Actor = {
  type: "user",
  id: "alice"
};
export const SYSTEM_ACTOR: EventStore.Actor = {
  type: "system",
  source: "fs-watcher"
};

/**
 * Every backend of the store, so a behaviour is pinned once for all of them
 * instead of drifting between two copies of the same suite.
 */
export const backends: {
  name: string;
  create(): Promise<EventStore.EventStore>;
}[] = [
  {
    name: "memory",
    create: () => Promise.resolve(
      EventStore.persistence.memory()
    )
  },
  {
    name: "sqlite",
    create: () => EventStore.persistence.sqlite()
  }
];

export function append(
  store: EventStore.EventStore,
  assetId: string,
  eventData: unknown = {},
  eventType = "pixel-set"
): EventStore.Event {
  return store.writer.append({
    assetType: "texture",
    assetId,
    eventType,
    eventData,
    actor: USER_ACTOR
  }).unwrap();
}

export function seed(
  store: EventStore.EventStore
): void {
  append(
    store,
    "a1",
    { path: "a.png" },
    "asset.created"
  );
  store.writer.append({
    assetType: "texture",
    assetId: "a2",
    eventType: "asset.created",
    eventData: { path: "b.png" },
    actor: SYSTEM_ACTOR
  }).unwrap();

  append(
    store,
    "a1",
    { x: 1 },
    "pixelart.stroke.applied"
  );
  append(
    store,
    "a2",
    { path: "b.png" },
    "asset.updated"
  );
}
