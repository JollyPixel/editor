// Import Third-party Dependencies
import {
  describe,
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import * as EventStore from "#src/index.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

type SpriteMap = {
  "sprite.created": { path: string; size: number; };
  "sprite.renamed": { from: string; to: string; };
};

type TextureMap = {
  "texture.created": { path: string; };
};

const typed = EventStore.persistence.memory<SpriteMap>();
const schemaless = EventStore.persistence.memory();

describe("schema-mapped append", () => {
  test("accepts a payload matching its event type", () => {
    expect(typed.writer.append).type.toBeCallableWith({
      assetType: "sprite",
      assetId: "a1",
      eventType: "sprite.created",
      eventData: {
        path: "a.png",
        size: 12
      },
      actor: kActor
    });
  });

  test("rejects a payload the event type does not describe", () => {
    expect(typed.writer.append).type.not.toBeCallableWith({
      assetType: "sprite",
      assetId: "a1",
      eventType: "sprite.created",
      eventData: {
        path: "a.png"
      },
      actor: kActor
    });
  });

  test("rejects a payload belonging to another event type", () => {
    expect(typed.writer.append).type.not.toBeCallableWith({
      assetType: "sprite",
      assetId: "a1",
      eventType: "sprite.renamed",
      eventData: {
        path: "a.png",
        size: 12
      },
      actor: kActor
    });
  });

  test("rejects an event type outside the map", () => {
    expect(typed.writer.append).type.not.toBeCallableWith({
      assetType: "sprite",
      assetId: "a1",
      eventType: "sprite.deleted",
      eventData: {},
      actor: kActor
    });
  });

  test("a schemaless store accepts any event type and payload", () => {
    expect(schemaless.writer.append).type.toBeCallableWith({
      assetType: "sprite",
      assetId: "a1",
      eventType: "anything.at.all",
      eventData: {
        whatever: true
      },
      actor: kActor
    });
  });
});

describe("variance", () => {
  test("a typed store stands in for a schemaless one", () => {
    expect(typed).type.toBeAssignableTo<EventStore.EventStore>();
  });

  test("a schemaless store stands in for a typed one", () => {
    expect(schemaless).type.toBeAssignableTo<
      EventStore.TypedEventStore<SpriteMap>
    >();
  });

  test("a store carrying another map does not", () => {
    expect(typed).type.not.toBeAssignableTo<
      EventStore.TypedEventStore<TextureMap>
    >();
  });
});

describe("reads", () => {
  test("hand back events whose payload stays unknown", async() => {
    const [event] = await typed.reader.list("a1");

    expect(event.eventData).type.toBe<unknown>();
    expect(event.eventData).type.not.toBeAssignableTo<
      { path: string; }
    >();
  });

  test("a guard is what narrows a stored event", async() => {
    const [event] = await typed.reader.list("a1");

    expect<EventStore.TypedEvent<SpriteMap>>()
      .type.toBeAssignableTo<EventStore.Event>();
    expect(event).type.not.toBeAssignableTo<
      EventStore.TypedEvent<SpriteMap>
    >();
  });
});

describe("subscribe", () => {
  test("takes the same prefix filter as the reader", () => {
    expect(typed.subscribe).type.toBeCallableWith(
      () => void 0,
      { eventTypePrefix: "sprite." }
    );
    expect(typed.subscribe).type.not.toBeCallableWith(
      () => void 0,
      { eventTypePrefix: 12 }
    );
  });

  test("does not narrow its listener to the schema map", () => {
    expect(typed.subscribe).type.not.toBeCallableWith(
      (event: EventStore.TypedEvent<SpriteMap>) => void event.eventData
    );
  });
});
