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
import {
  ServerRoom
} from "#src/server/ServerRoom.ts";
import {
  Extension,
  RightsTable,
  type ClientHandle,
  type RoomContext
} from "#src/index.ts";

class RecordingExtension extends Extension {
  readonly id = "pixel-draw";
  readonly name = "pixel-draw";
  connected: string[] = [];
  disconnected: string[] = [];
  messages: { clientId: string; payload: unknown; }[] = [];
  handles = new Map<string, ClientHandle>();
  contexts: RoomContext[] = [];

  onClientConnect(
    client: ClientHandle,
    _identity: unknown,
    context: RoomContext
  ): void {
    this.connected.push(client.id);
    this.handles.set(client.id, client);
    this.contexts.push(context);
  }

  onClientDisconnect(
    clientId: string,
    context: RoomContext
  ): void {
    this.disconnected.push(clientId);
    this.contexts.push(context);
  }

  onMessage(
    clientId: string,
    payload: unknown,
    context: RoomContext
  ): void {
    this.messages.push({ clientId, payload });
    this.contexts.push(context);
  }
}

class RightsAwareExtension extends Extension {
  readonly id = "pixel-draw";
  readonly name = "pixel-draw";
  messages: { clientId: string; payload: unknown; }[] = [];
  contexts: RoomContext[] = [];

  onClientConnect(
    _client: ClientHandle,
    _identity: unknown,
    context: RoomContext
  ): void {
    this.contexts.push(context);
  }

  onClientDisconnect(): void {
    // Not exercised by these rights tests.
  }

  override getEventName(
    payload: unknown
  ): string {
    return (payload as { action: string; }).action;
  }

  onMessage(
    clientId: string,
    payload: unknown,
    context: RoomContext
  ): void {
    this.messages.push({ clientId, payload });
    this.contexts.push(context);
  }
}

function createClient(
  id: string
): { client: ClientHandle; sent: unknown[]; } {
  const sent: unknown[] = [];

  return {
    client: { id, send: (data) => sent.push(data) },
    sent
  };
}

function createRoom(
  extension: Extension,
  rights?: RightsTable,
  eventStore?: EventStore.EventStore
): ServerRoom {
  return new ServerRoom(extension, rights, { eventStore });
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
    reader: { list: () => [] },
    close: () => void 0,
    [Symbol.dispose]() {
      this.close();
    }
  };
}

describe("ServerRoom", () => {
  test("join notifies existing members but not the joiner itself", () => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension);

    room.join("A", a.client, {});
    assert.deepEqual(a.sent, []);

    room.join("B", b.client, { username: "bob" });
    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      identity: { username: "bob" }
    }]);
    assert.deepEqual(extension.connected, ["A", "B"]);
  });

  test("join sends a sync snapshot of pre-existing members to the joiner, omitted when there are none", () => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension);

    room.join("A", a.client, { username: "alice" });
    assert.deepEqual(a.sent, []);

    room.join("B", b.client, {});
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "sync",
      members: [{ clientId: "A", identity: { username: "alice" }, presence: {} }]
    }]);
  });

  test("scoped client passed to onClientConnect auto-tags send() with the room", () => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const room = createRoom(extension);

    room.join("A", a.client, {});
    extension.handles.get("A")?.send({ type: "snapshot" });

    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "message",
      payload: { type: "snapshot" }
    }]);
  });

  test("leave broadcasts peer-left to remaining members, excluding the leaver, and notifies the extension", () => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension);
    room.join("A", a.client, {});
    room.join("B", b.client, {});
    a.sent.length = 0;
    b.sent.length = 0;

    room.leave("B");

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "peer-left", clientId: "B" }]);
    assert.deepEqual(b.sent, []);
    assert.deepEqual(extension.disconnected, ["B"]);
  });

  test("updatePresence merges into stored state and broadcasts to other members, excluding the sender", () => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension);
    room.join("A", a.client, {});
    room.join("B", b.client, {});
    a.sent.length = 0;
    b.sent.length = 0;

    room.updatePresence("A", { cursor: { x: 5, y: 5 } });

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "peer-presence",
      clientId: "A",
      patch: { cursor: { x: 5, y: 5 } }
    }]);
  });

  test("updatePresence for an unknown member is a no-op", () => {
    const extension = new RecordingExtension();
    const room = createRoom(extension);

    assert.doesNotThrow(() => room.updatePresence("A", { cursor: { x: 1, y: 1 } }));
  });

  test("message forwards clientId and payload to the extension", () => {
    const extension = new RecordingExtension();
    const room = createRoom(extension);

    room.message("A", { hello: "world" });

    assert.deepEqual(extension.messages, [{ clientId: "A", payload: { hello: "world" } }]);
  });

  test("the RoomContext's room.broadcast sends to every current member, envelope-wrapped like a scoped send", () => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension);
    room.join("A", a.client, {});
    room.join("B", b.client, {});
    a.sent.length = 0;
    b.sent.length = 0;

    extension.contexts.at(-1)!.room.broadcast({ hello: "world" });

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "message", payload: { hello: "world" } }]);
    assert.deepEqual(b.sent, [{ room: "pixel-draw", kind: "message", payload: { hello: "world" } }]);
  });

  test("room.broadcast is a no-op before any client has joined", () => {
    const extension = new RecordingExtension();
    const room = createRoom(extension);

    room.message("nobody", { hello: "world" });
    const context = extension.contexts.at(-1)!;

    assert.doesNotThrow(() => context.room.broadcast({ hello: "world" }));
  });
});

describe("ServerRoom — rights: $join", () => {
  test("a role with \"write\" on $join is admitted", () => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$join": "write" } }));

    const admitted = room.join("A", a.client, { role: "viewer" });

    assert.strictEqual(admitted, true);
    assert.deepEqual(a.sent, []);
  });

  test("a role with \"void\" on $join is denied and never becomes a member", () => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$join": "void" } }));

    const admitted = room.join("A", a.client, { role: "viewer" });

    assert.strictEqual(admitted, false);
    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "denied",
      event: "$join",
      reason: "role \"viewer\" is not permitted to join this room"
    }]);
  });

  test("a role with \"read\" on $join collapses to denied, same as void", () => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$join": "read" } }));

    assert.strictEqual(room.join("A", a.client, { role: "viewer" }), false);
  });

  test("an unrecognized role fails open (admitted) even when rights is configured", () => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$join": "void" } }));

    assert.strictEqual(room.join("A", a.client, {}), true);
  });

  test("a glob pattern (\"pixel-draw.*\") matches the namespaced $join key", () => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.*": "void" } }));

    assert.strictEqual(room.join("A", a.client, { role: "viewer" }), false);
  });
});

describe("ServerRoom — rights: $presence", () => {
  test("a role with \"write\" on $presence can update presence", () => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$presence": "write" } }));
    room.join("A", a.client, { role: "viewer" });

    assert.doesNotThrow(() => room.updatePresence("A", { cursor: { x: 1, y: 1 } }));
  });

  test("a role with \"void\" on $presence is denied and its patch is not applied", () => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$presence": "void" } }));
    room.join("A", a.client, { role: "viewer" });
    room.join("B", b.client, {});
    a.sent.length = 0;
    b.sent.length = 0;

    room.updatePresence("A", { cursor: { x: 1, y: 1 } });

    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "denied",
      event: "$presence",
      reason: "role \"viewer\" cannot update presence"
    }]);
    assert.deepEqual(b.sent, []);
  });

  test("a role with \"void\" on $presence is filtered out of other members' presence broadcasts", () => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$presence": "void" } }));
    room.join("A", a.client, {});
    room.join("B", b.client, { role: "viewer" });
    a.sent.length = 0;
    b.sent.length = 0;

    room.updatePresence("A", { cursor: { x: 1, y: 1 } });

    assert.deepEqual(b.sent, []);
  });
});

describe("ServerRoom — rights: message write gate", () => {
  test("a role with \"write\" on the event reaches the extension", () => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ editor: { "pixel-draw.voxel-set": "write" } }));
    room.join("A", a.client, { role: "editor" });

    room.message("A", { action: "voxel-set" });

    assert.deepEqual(extension.messages, [{ clientId: "A", payload: { action: "voxel-set" } }]);
  });

  test("a role with \"read\" on the event is denied and never reaches the extension", () => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.voxel-set": "read" } }));
    room.join("A", a.client, { role: "viewer" });
    a.sent.length = 0;

    room.message("A", { action: "voxel-set" });

    assert.deepEqual(extension.messages, []);
    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "denied",
      event: "voxel-set",
      reason: "role \"viewer\" cannot write \"voxel-set\""
    }]);
  });

  test("a glob pattern (\"pixel-draw.*\") covers every event without listing each one", () => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    // "pixel-draw.*" also matches "pixel-draw.$join" — list the more specific
    // rule first so join stays admitted (first match wins, see RightsTable).
    const room = createRoom(extension, new RightsTable({
      viewer: {
        "pixel-draw.$join": "write",
        "pixel-draw.*": "read"
      }
    }));
    const admitted = room.join("A", a.client, { role: "viewer" });

    room.message("A", { action: "voxel-set" });
    room.message("A", { action: "object-added" });

    assert.strictEqual(admitted, true);
    assert.deepEqual(extension.messages, []);
  });
});

describe("ServerRoom — rights: broadcast read gate", () => {
  test("a role with \"void\" on the event is excluded from the broadcast; \"read\" still receives it", () => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension, new RightsTable({
      blocked: { "pixel-draw.voxel-set": "void" },
      allowed: { "pixel-draw.voxel-set": "read" }
    }));
    room.join("A", a.client, { role: "blocked" });
    room.join("B", b.client, { role: "allowed" });
    a.sent.length = 0;
    b.sent.length = 0;

    extension.contexts.at(-1)!.room.broadcast({ action: "voxel-set" });

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "message",
      payload: { action: "voxel-set" }
    }]);
  });
});

describe("ServerRoom — event store: append", () => {
  test("defaults to an in-memory store and returns true on success", () => {
    const extension = new RecordingExtension();
    const room = createRoom(extension);

    room.message("A", {});
    const { eventStore } = extension.contexts.at(-1)!;
    const appended = eventStore.append({
      assetType: "texture", assetId: "asset-1", eventType: "pixel-set", eventData: { x: 1 }
    });

    assert.strictEqual(appended, true);
    assert.deepEqual(eventStore.list("asset-1").map((event) => event.eventData), [{ x: 1 }]);
  });

  test("on failure, notifies the client with an error envelope and returns false", () => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const room = createRoom(extension, undefined, createFailingEventStore());
    room.join("A", a.client, {});
    a.sent.length = 0;

    const { eventStore } = extension.contexts.at(-1)!;
    const appended = eventStore.append({
      assetType: "texture", assetId: "asset-1", eventType: "pixel-set", eventData: { x: 1 }
    });

    assert.strictEqual(appended, false);
    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "error",
      event: "pixel-set",
      reason: "disk full"
    }]);
  });

  test("two rooms sharing the same EventStore append to the same asset log", () => {
    const eventStore = EventStore.persistence.memory();
    const extensionA = new RecordingExtension();
    const extensionB = new RecordingExtension();
    const roomA = createRoom(extensionA, undefined, eventStore);
    const roomB = createRoom(extensionB, undefined, eventStore);

    roomA.message("A", {});
    extensionA.contexts.at(-1)!.eventStore.append({
      assetType: "texture", assetId: "asset-1", eventType: "pixel-set", eventData: { x: 1 }
    });
    roomB.message("B", {});
    extensionB.contexts.at(-1)!.eventStore.append({
      assetType: "texture", assetId: "asset-1", eventType: "pixel-set", eventData: { x: 2 }
    });

    assert.deepEqual(
      eventStore.reader.list("asset-1").map((event) => event.eventData),
      [{ x: 1 }, { x: 2 }]
    );
  });
});

describe("ServerRoom — event store: RoomContext passed to the extension exposes the eventStore facade", () => {
  test("the extension can append and read events through context.eventStore", () => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    room.join("A", a.client, {});

    room.message("A", { hello: "world" });
    const { eventStore } = extension.contexts.at(-1)!;
    eventStore.append({
      assetType: "texture", assetId: "asset-1", eventType: "pixel-set", eventData: { x: 1 }
    });

    assert.deepEqual(eventStore.list("asset-1").map((event) => event.eventData), [{ x: 1 }]);
  });
});
