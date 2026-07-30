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
  RightsTable,
  type ClientHandle,
  type RoomHandle
} from "#src/index.ts";

class RecordingAuthority extends RoomAuthority {
  readonly id = "pixel-draw";
  readonly name = "pixel-draw";
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

class RightsAwareAuthority extends RoomAuthority {
  readonly id = "pixel-draw";
  readonly name = "pixel-draw";
  messages: { clientId: string; payload: unknown; }[] = [];

  onClientConnect(): void {
    // Not exercised by these rights tests.
  }

  onClientDisconnect(): void {
    // Not exercised by these rights tests.
  }

  getEventName(
    payload: unknown
  ): string {
    return (payload as { action: string; }).action;
  }

  onMessage(
    clientId: string,
    payload: unknown
  ): void {
    this.messages.push({ clientId, payload });
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
  authority: RoomAuthority,
  rights?: RightsTable
): ServerRoom {
  return new ServerRoom(authority, rights);
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

describe("ServerRoom — rights: $join", () => {
  test("a role with \"write\" on $join is admitted", () => {
    const authority = new RightsAwareAuthority();
    const a = createClient("A");
    const room = createRoom(authority, new RightsTable({ viewer: { "pixel-draw.$join": "write" } }));

    const admitted = room.join("A", a.client, { role: "viewer" });

    assert.strictEqual(admitted, true);
    assert.deepEqual(a.sent, []);
  });

  test("a role with \"void\" on $join is denied and never becomes a member", () => {
    const authority = new RightsAwareAuthority();
    const a = createClient("A");
    const room = createRoom(authority, new RightsTable({ viewer: { "pixel-draw.$join": "void" } }));

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
    const authority = new RightsAwareAuthority();
    const a = createClient("A");
    const room = createRoom(authority, new RightsTable({ viewer: { "pixel-draw.$join": "read" } }));

    assert.strictEqual(room.join("A", a.client, { role: "viewer" }), false);
  });

  test("an unrecognized role fails open (admitted) even when rights is configured", () => {
    const authority = new RightsAwareAuthority();
    const a = createClient("A");
    const room = createRoom(authority, new RightsTable({ viewer: { "pixel-draw.$join": "void" } }));

    assert.strictEqual(room.join("A", a.client, {}), true);
  });

  test("a glob pattern (\"pixel-draw.*\") matches the namespaced $join key", () => {
    const authority = new RightsAwareAuthority();
    const a = createClient("A");
    const room = createRoom(authority, new RightsTable({ viewer: { "pixel-draw.*": "void" } }));

    assert.strictEqual(room.join("A", a.client, { role: "viewer" }), false);
  });
});

describe("ServerRoom — rights: $presence", () => {
  test("a role with \"write\" on $presence can update presence", () => {
    const authority = new RightsAwareAuthority();
    const a = createClient("A");
    const room = createRoom(authority, new RightsTable({ viewer: { "pixel-draw.$presence": "write" } }));
    room.join("A", a.client, { role: "viewer" });

    assert.doesNotThrow(() => room.updatePresence("A", { cursor: { x: 1, y: 1 } }));
  });

  test("a role with \"void\" on $presence is denied and its patch is not applied", () => {
    const authority = new RightsAwareAuthority();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(authority, new RightsTable({ viewer: { "pixel-draw.$presence": "void" } }));
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
    const authority = new RightsAwareAuthority();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(authority, new RightsTable({ viewer: { "pixel-draw.$presence": "void" } }));
    room.join("A", a.client, {});
    room.join("B", b.client, { role: "viewer" });
    a.sent.length = 0;
    b.sent.length = 0;

    room.updatePresence("A", { cursor: { x: 1, y: 1 } });

    assert.deepEqual(b.sent, []);
  });
});

describe("ServerRoom — rights: message write gate", () => {
  test("a role with \"write\" on the event reaches the authority", () => {
    const authority = new RightsAwareAuthority();
    const a = createClient("A");
    const room = createRoom(authority, new RightsTable({ editor: { "pixel-draw.voxel-set": "write" } }));
    room.join("A", a.client, { role: "editor" });

    room.message("A", { action: "voxel-set" });

    assert.deepEqual(authority.messages, [{ clientId: "A", payload: { action: "voxel-set" } }]);
  });

  test("a role with \"read\" on the event is denied and never reaches the authority", () => {
    const authority = new RightsAwareAuthority();
    const a = createClient("A");
    const room = createRoom(authority, new RightsTable({ viewer: { "pixel-draw.voxel-set": "read" } }));
    room.join("A", a.client, { role: "viewer" });
    a.sent.length = 0;

    room.message("A", { action: "voxel-set" });

    assert.deepEqual(authority.messages, []);
    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "denied",
      event: "voxel-set",
      reason: "role \"viewer\" cannot write \"voxel-set\""
    }]);
  });

  test("a glob pattern (\"pixel-draw.*\") covers every event without listing each one", () => {
    const authority = new RightsAwareAuthority();
    const a = createClient("A");
    // "pixel-draw.*" also matches "pixel-draw.$join" — list the more specific
    // rule first so join stays admitted (first match wins, see RightsTable).
    const room = createRoom(authority, new RightsTable({
      viewer: {
        "pixel-draw.$join": "write",
        "pixel-draw.*": "read"
      }
    }));
    const admitted = room.join("A", a.client, { role: "viewer" });

    room.message("A", { action: "voxel-set" });
    room.message("A", { action: "object-added" });

    assert.strictEqual(admitted, true);
    assert.deepEqual(authority.messages, []);
  });
});

describe("ServerRoom — rights: broadcast read gate", () => {
  test("a role with \"void\" on the event is excluded from the broadcast; \"read\" still receives it", () => {
    const authority = new RightsAwareAuthority();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(authority, new RightsTable({
      blocked: { "pixel-draw.voxel-set": "void" },
      allowed: { "pixel-draw.voxel-set": "read" }
    }));
    room.join("A", a.client, { role: "blocked" });
    room.join("B", b.client, { role: "allowed" });
    a.sent.length = 0;
    b.sent.length = 0;

    room.broadcast({ action: "voxel-set" });

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "message",
      payload: { action: "voxel-set" }
    }]);
  });
});
