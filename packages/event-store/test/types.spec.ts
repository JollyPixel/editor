// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import * as EventStore from "#src/index.ts";
import { USER_ACTOR } from "./helpers/backends.ts";

// CONSTANTS
const kSpriteMap = {
  "sprite.created": {} as { path: string; size: number; },
  "sprite.renamed": {} as { from: string; to: string; }
};

type SpriteMap = typeof kSpriteMap;

describe("schema-mapped typing", () => {
  test("append accepts a payload matching its event type", () => {
    const store = EventStore.persistence.memory<SpriteMap>();
    using _dispose = store;

    const event = store.writer.append({
      assetType: "sprite",
      assetId: "a1",
      eventType: "sprite.created",
      eventData: {
        path: "a.png",
        size: 12
      },
      actor: USER_ACTOR
    }).unwrap();

    assert.strictEqual(event.eventType, "sprite.created");
  });

  test("append rejects a payload the event type does not describe", () => {
    const store = EventStore.persistence.memory<SpriteMap>();
    using _dispose = store;

    store.writer.append({
      assetType: "sprite",
      assetId: "a1",
      eventType: "sprite.created",
      // @ts-expect-error `size` is missing from the create payload
      eventData: {
        path: "a.png"
      },
      actor: USER_ACTOR
    });

    assert.strictEqual(store.reader.list("a1").length, 1);
  });

  test("append rejects an event type outside the map", () => {
    const store = EventStore.persistence.memory<SpriteMap>();
    using _dispose = store;

    store.writer.append({
      assetType: "sprite",
      assetId: "a1",
      // @ts-expect-error "sprite.deleted" is not a key of SpriteMap
      eventType: "sprite.deleted",
      eventData: {} as never,
      actor: USER_ACTOR
    });

    assert.strictEqual(store.reader.list("a1").length, 1);
  });

  test("a schemaless store still accepts any event type and payload", () => {
    using store = EventStore.persistence.memory();

    const event = store.writer.append({
      assetType: "sprite",
      assetId: "a1",
      eventType: "anything.at.all",
      eventData: {
        whatever: true
      },
      actor: USER_ACTOR
    }).unwrap();

    assert.strictEqual(event.eventType, "anything.at.all");
  });

  test("a typed store is usable where a schemaless one is expected", () => {
    using store = EventStore.persistence.memory<SpriteMap>();

    const widened: EventStore.EventStore = store;

    assert.strictEqual(widened.reader.list("a1").length, 0);
  });

  test("reads stay unknown, so a guard is the only way to narrow", () => {
    using store = EventStore.persistence.memory<SpriteMap>();
    store.writer.append({
      assetType: "sprite",
      assetId: "a1",
      eventType: "sprite.created",
      eventData: {
        path: "a.png",
        size: 12
      },
      actor: USER_ACTOR
    }).unwrap();

    const [event] = store.reader.list("a1");
    // @ts-expect-error `eventData` is unknown until the caller validates it
    const unchecked: { path: string; } = event.eventData;
    void unchecked;

    assert.ok(isSpriteCreated(event));
    assert.strictEqual(event.eventData.path, "a.png");
  });
});

function isSpriteCreated(
  event: EventStore.Event
): event is Extract<
  EventStore.TypedEvent<SpriteMap>,
  { eventType: "sprite.created"; }
> {
  return event.eventType === "sprite.created" &&
    typeof event.eventData === "object" &&
    event.eventData !== null &&
    typeof (event.eventData as { path?: unknown; }).path === "string";
}
