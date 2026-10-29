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
  },
  {
    name: "indexeddb",
    create: () => EventStore.persistence.indexeddb({
      name: crypto.randomUUID()
    })
  }
];

export async function append(
  store: EventStore.EventStore,
  assetId: string,
  eventData: unknown = {},
  eventType = "pixel-set"
): Promise<EventStore.Event> {
  return (await store.writer.append({
    assetType: "texture",
    assetId,
    eventType,
    eventData,
    actor: USER_ACTOR
  })).unwrap();
}

export async function tag(
  store: EventStore.EventStore,
  assetId: string,
  name: string,
  eventVersion = 1
): Promise<EventStore.EventTag> {
  return (await store.tags.create({
    assetId,
    name,
    eventVersion,
    actor: USER_ACTOR
  })).unwrap();
}

export async function seed(
  store: EventStore.EventStore
): Promise<void> {
  await append(
    store,
    "a1",
    { path: "a.png" },
    "asset.created"
  );
  (await store.writer.append({
    assetType: "texture",
    assetId: "a2",
    eventType: "asset.created",
    eventData: { path: "b.png" },
    actor: SYSTEM_ACTOR
  })).unwrap();

  await append(
    store,
    "a1",
    { x: 1 },
    "pixelart.stroke.applied"
  );
  await append(
    store,
    "a2",
    { path: "b.png" },
    "asset.updated"
  );
}
