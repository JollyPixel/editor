// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ServerRoom
} from "#src/server/ServerRoom.ts";
import {
  RoomAuthority,
  type ClientHandle,
  type RoomHandle
} from "#src/index.ts";

class RecordingAuthority extends RoomAuthority {
  readonly id = "pixel-draw";
  connected: string[] = [];
  disconnected: string[] = [];
  messages: { clientId: string; payload: unknown; }[] = [];
  handles = new Map<string, ClientHandle>();
  rooms: RoomHandle[] = [];

  onClientConnect(
    client: ClientHandle,
    _identity: unknown,
    room: RoomHandle
  ): void {
    this.connected.push(client.id);
    this.handles.set(client.id, client);
    this.rooms.push(room);
  }

  onClientDisconnect(
    clientId: string,
    room: RoomHandle
  ): void {
    this.disconnected.push(clientId);
    this.rooms.push(room);
  }

  onMessage(
    clientId: string,
    payload: unknown,
    room: RoomHandle
  ): void {
    this.messages.push({ clientId, payload });
    this.rooms.push(room);
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
  authority: RoomAuthority
): ServerRoom {
  return new ServerRoom(authority);
}

describe("ServerRoom", () => {
  test("join notifies existing members but not the joiner itself", () => {
    const authority = new RecordingAuthority();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(authority);

    room.join("A", a.client, {});
    assert.deepEqual(a.sent, []);

    room.join("B", b.client, { username: "bob" });
    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      identity: { username: "bob" }
    }]);
    assert.deepEqual(authority.connected, ["A", "B"]);
  });

  test("join sends a sync snapshot of pre-existing members to the joiner, omitted when there are none", () => {
    const authority = new RecordingAuthority();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(authority);

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
    const authority = new RecordingAuthority();
    const a = createClient("A");
    const room = createRoom(authority);

    room.join("A", a.client, {});
    authority.handles.get("A")?.send({ type: "snapshot" });

    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "message",
      payload: { type: "snapshot" }
    }]);
  });

  test("leave broadcasts peer-left to remaining members, excluding the leaver, and notifies the authority", () => {
    const authority = new RecordingAuthority();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(authority);
    room.join("A", a.client, {});
    room.join("B", b.client, {});
    a.sent.length = 0;
    b.sent.length = 0;

    room.leave("B");

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "peer-left", clientId: "B" }]);
    assert.deepEqual(b.sent, []);
    assert.deepEqual(authority.disconnected, ["B"]);
  });

  test("updatePresence merges into stored state and broadcasts to other members, excluding the sender", () => {
    const authority = new RecordingAuthority();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(authority);
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
    const authority = new RecordingAuthority();
    const room = createRoom(authority);

    assert.doesNotThrow(() => room.updatePresence("A", { cursor: { x: 1, y: 1 } }));
  });

  test("message forwards clientId and payload to the authority", () => {
    const authority = new RecordingAuthority();
    const room = createRoom(authority);

    room.message("A", { hello: "world" });

    assert.deepEqual(authority.messages, [{ clientId: "A", payload: { hello: "world" } }]);
  });

  test("broadcast sends to every current member, envelope-wrapped like a scoped send", () => {
    const authority = new RecordingAuthority();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(authority);
    room.join("A", a.client, {});
    room.join("B", b.client, {});
    a.sent.length = 0;
    b.sent.length = 0;

    room.broadcast({ hello: "world" });

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "message", payload: { hello: "world" } }]);
    assert.deepEqual(b.sent, [{ room: "pixel-draw", kind: "message", payload: { hello: "world" } }]);
  });

  test("broadcast is a no-op before any client has joined", () => {
    const authority = new RecordingAuthority();
    const room = createRoom(authority);

    assert.doesNotThrow(() => room.broadcast({ hello: "world" }));
  });

  test("the RoomHandle passed to the authority is the room itself, usable to broadcast", () => {
    const authority = new RecordingAuthority();
    const a = createClient("A");
    const room = createRoom(authority);
    room.join("A", a.client, {});
    a.sent.length = 0;

    assert.strictEqual(authority.rooms.at(-1), room);
    authority.rooms.at(-1)?.broadcast({ hello: "world" });

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "message", payload: { hello: "world" } }]);
  });
});
