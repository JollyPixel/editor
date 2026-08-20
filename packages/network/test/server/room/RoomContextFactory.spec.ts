// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Err,
  type Result
} from "@openally/result";
import { Emitter } from "@openally/emitt";
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { RoomContextFactory } from "#src/server/room/RoomContextFactory.ts";
import { RoomMembers } from "#src/server/room/RoomMembers.ts";
import type {
  ClientHandle,
  PeerMetadata,
  RoomBroadcast
} from "#src/index.ts";

// CONSTANTS
const kRoomId = "pixel-draw";

function createClient(
  id: string
): { client: ClientHandle; sent: unknown[]; } {
  const sent: unknown[] = [];

  return {
    client: { id, send: (data) => sent.push(data) },
    sent
  };
}

function createBroadcast(): RoomBroadcast {
  return {
    broadcast: () => void 0,
    sendTo: () => void 0
  };
}

function createFactory(
  members = new RoomMembers(),
  eventStore?: EventStore.EventStore
): RoomContextFactory {
  return new RoomContextFactory({
    roomId: kRoomId,
    members,
    broadcast: createBroadcast(),
    eventStore
  });
}

function addMember(
  members: RoomMembers,
  clientId: string,
  identity: PeerMetadata
): unknown[] {
  const { client, sent } = createClient(clientId);
  members.add(clientId, {
    handle: client,
    identity,
    presence: {},
    role: "default"
  });

  return sent;
}

class FailingEventWriter extends Emitter<
  EventStore.EventStoreEventMap
> implements EventStore.EventWriter {
  append(
    _input: EventStore.AppendInput
  ): Result<EventStore.Event, Error> {
    return Err(new Error("disk full"));
  }
}

function createFailingEventStore(): EventStore.EventStore {
  return {
    writer: new FailingEventWriter(),
    reader: {
      list: () => [],
      listAll: () => []
    },
    close: () => void 0,
    [Symbol.dispose]() {
      this.close();
    }
  };
}

describe("RoomContextFactory — actor resolution", () => {
  test("prefers a stable userId from the member identity", () => {
    const members = new RoomMembers();
    addMember(members, "client-1", { userId: "user-42" });

    assert.deepEqual(createFactory(members).resolveActor("client-1"), {
      type: "user",
      id: "user-42"
    });
  });

  test("falls back to the clientId when the identity has no userId", () => {
    const members = new RoomMembers();
    addMember(members, "client-1", { username: "bob" });

    assert.deepEqual(createFactory(members).resolveActor("client-1"), {
      type: "user",
      id: "client-1"
    });
  });

  test("falls back to the clientId when the userId is not a string", () => {
    const members = new RoomMembers();
    addMember(members, "client-1", { userId: 42 });

    assert.deepEqual(createFactory(members).resolveActor("client-1"), {
      type: "user",
      id: "client-1"
    });
  });

  test("falls back to the clientId for an unknown member", () => {
    assert.deepEqual(createFactory().resolveActor("ghost"), {
      type: "user",
      id: "ghost"
    });
  });
});

describe("RoomContextFactory — event store handle", () => {
  test("stamps appends with the resolved actor", async() => {
    const members = new RoomMembers();
    addMember(members, "client-1", { userId: "user-42" });

    using eventStore = EventStore.persistence.memory();
    const context = createFactory(members, eventStore).create("client-1");

    const appended = await context.eventStore.append({
      assetType: "sprite",
      assetId: "sprite-1",
      eventType: "created",
      eventData: {}
    });

    assert.strictEqual(appended, true);
    const [event] = await context.eventStore.list("sprite-1");
    assert.deepEqual(event.actor, {
      type: "user",
      id: "user-42"
    });
  });

  test("keeps an explicitly passed actor after the member is removed", async() => {
    const members = new RoomMembers();
    addMember(members, "client-1", { userId: "user-42" });

    using eventStore = EventStore.persistence.memory();
    const factory = createFactory(members, eventStore);
    const actor = factory.resolveActor("client-1");
    members.remove("client-1");

    await factory.create("client-1", actor).eventStore.append({
      assetType: "sprite",
      assetId: "sprite-1",
      eventType: "created",
      eventData: {}
    });

    const [event] = await factory.create("client-1", actor)
      .eventStore
      .list("sprite-1");
    assert.deepEqual(event.actor, {
      type: "user",
      id: "user-42"
    });
  });

  test("reports a rejected append to its author as an \"error\" envelope", async() => {
    const members = new RoomMembers();
    const sent = addMember(members, "client-1", {});

    const context = createFactory(members, createFailingEventStore())
      .create("client-1");
    const appended = await context.eventStore.append({
      assetType: "sprite",
      assetId: "sprite-1",
      eventType: "created",
      eventData: {}
    });

    assert.strictEqual(appended, false);
    assert.deepEqual(sent, [{
      room: kRoomId,
      kind: "error",
      event: "created",
      reason: "disk full"
    }]);
  });

  test("a rejected append for an unknown member notifies nobody", async() => {
    const members = new RoomMembers();
    const sent = addMember(members, "client-1", {});

    const context = createFactory(members, createFailingEventStore())
      .create("ghost");
    const appended = await context.eventStore.append({
      assetType: "sprite",
      assetId: "sprite-1",
      eventType: "created",
      eventData: {}
    });

    assert.strictEqual(appended, false);
    assert.deepEqual(sent, []);
  });

  test("defaults to an in-memory store when none is provided", async() => {
    const context = createFactory().create("client-1");

    const appended = await context.eventStore.append({
      assetType: "sprite",
      assetId: "sprite-1",
      eventType: "created",
      eventData: {}
    });

    assert.strictEqual(appended, true);
    assert.strictEqual((await context.eventStore.list("sprite-1")).length, 1);
  });
});
