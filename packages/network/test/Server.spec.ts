// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Server,
  RoomAuthority,
  type ClientHandle,
  type RoomHandle
} from "#src/index.ts";

class RecordingAuthority extends RoomAuthority {
  readonly id: string;
  readonly name: string;
  connected: string[] = [];
  disconnected: string[] = [];
  messages: { clientId: string; payload: unknown; }[] = [];
  handles = new Map<string, ClientHandle>();
  room: RoomHandle | undefined;

  constructor(
    id: string,
    name: string = id
  ) {
    super();
    this.id = id;
    this.name = name;
  }

  onClientConnect(
    client: ClientHandle,
    _identity: unknown,
    room: RoomHandle
  ): void {
    this.connected.push(client.id);
    this.handles.set(client.id, client);
    this.room = room;
  }

  onClientDisconnect(
    clientId: string,
    room: RoomHandle
  ): void {
    this.disconnected.push(clientId);
    this.room = room;
  }

  onMessage(
    clientId: string,
    payload: unknown,
    room: RoomHandle
  ): void {
    this.messages.push({ clientId, payload });
    this.room = room;
  }

  getEventName(
    payload: unknown
  ): string {
    return (payload as { action: string; }).action;
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

describe("Server", () => {
  test("does not notify an authority until the client joins its room", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const { client } = createClient("A");
    server.handleConnect(client);
    assert.deepEqual(authority.connected, []);

    server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    assert.deepEqual(authority.connected, ["A"]);
  });

  test("routes messages only to the joined authority", () => {
    const server = new Server();
    const pixel = new RecordingAuthority("pixel-draw");
    const voxel = new RecordingAuthority("voxel");
    server.register(pixel);
    server.register(voxel);

    const { client } = createClient("A");
    server.handleConnect(client);
    server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    server.handleMessage("A", {
      room: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    });
    server.handleMessage("A", {
      room: "voxel",
      kind: "message",
      payload: { should: "be dropped" }
    });

    assert.deepEqual(pixel.messages, [{ clientId: "A", payload: { hello: "world" } }]);
    assert.deepEqual(voxel.messages, []);
  });

  test("scoped client.send() auto-tags outgoing payloads with the room", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const { client, sent } = createClient("A");
    server.handleConnect(client);
    server.handleMessage("A", { room: "pixel-draw", kind: "join" });

    authority.handles.get("A")?.send({ type: "snapshot" });

    assert.deepEqual(sent, [{
      room: "pixel-draw",
      kind: "message",
      payload: { type: "snapshot" }
    }]);
  });

  test("leave notifies the authority once and stops routing further messages", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const { client } = createClient("A");
    server.handleConnect(client);
    server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    server.handleMessage("A", { room: "pixel-draw", kind: "leave" });
    server.handleMessage("A", {
      room: "pixel-draw",
      kind: "message",
      payload: {}
    });

    assert.deepEqual(authority.disconnected, ["A"]);
    assert.deepEqual(authority.messages, []);
  });

  test("disconnect notifies only authorities the client had joined", () => {
    const server = new Server();
    const pixel = new RecordingAuthority("pixel-draw");
    const voxel = new RecordingAuthority("voxel");
    server.register(pixel);
    server.register(voxel);

    const { client } = createClient("A");
    server.handleConnect(client);
    server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    server.handleDisconnect("A");

    assert.deepEqual(pixel.disconnected, ["A"]);
    assert.deepEqual(voxel.disconnected, []);
  });

  test("ignores malformed envelopes and unknown rooms", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const { client } = createClient("A");
    server.handleConnect(client);

    assert.doesNotThrow(() => {
      server.handleMessage("A", "not an envelope");
      server.handleMessage("A", { room: "unknown", kind: "join" });
      server.handleMessage("A", { room: "pixel-draw", kind: "message", payload: {} });
    });
    assert.deepEqual(authority.connected, []);
    assert.deepEqual(authority.messages, []);
  });
});

describe("Server — peer presence", () => {
  test("notifies existing room members when a new client joins, but not the joiner itself", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);

    server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    assert.deepEqual(a.sent, []);

    server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      identity: Object.create(null)
    }]);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "sync",
      members: [
        { clientId: "A", identity: Object.create(null), presence: {} }
      ]
    }]);
  });

  test("notifies remaining members on explicit leave, but not the leaver", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    a.sent.length = 0;
    b.sent.length = 0;

    server.handleMessage("B", { room: "pixel-draw", kind: "leave" });

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "peer-left", clientId: "B" }]);
    assert.deepEqual(b.sent, []);
  });

  test("notifies remaining members when a client disconnects", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    a.sent.length = 0;

    server.handleDisconnect("B");

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "peer-left", clientId: "B" }]);
  });

  test("does not leak peer events across rooms", () => {
    const server = new Server();
    const pixel = new RecordingAuthority("pixel-draw");
    const voxel = new RecordingAuthority("voxel");
    server.register(pixel);
    server.register(voxel);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { room: "voxel", kind: "join" });

    server.handleMessage("B", { room: "pixel-draw", kind: "join" });

    assert.deepEqual(a.sent, []);
  });
});

describe("Server — peer metadata", () => {
  test("peer-joined sent to existing members includes the joiner's identity", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { room: "pixel-draw", kind: "join" });

    server.handleMessage("B", {
      room: "pixel-draw",
      kind: "join",
      identity: { username: "bob" }
    });

    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      identity: { username: "bob" }
    }]);
  });

  test("a joiner with no existing members receives no sync envelope", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const { client, sent } = createClient("A");
    server.handleConnect(client);

    server.handleMessage("A", { room: "pixel-draw", kind: "join" });

    assert.deepEqual(sent, []);
  });

  test("a joiner with existing members receives a sync snapshot of their identity and presence", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", {
      room: "pixel-draw",
      kind: "join",
      identity: { username: "alice" }
    });
    server.handleMessage("A", {
      room: "pixel-draw",
      kind: "presence",
      patch: { cursor: { x: 1, y: 2 } }
    });
    b.sent.length = 0;

    server.handleMessage("B", { room: "pixel-draw", kind: "join" });

    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "sync",
      members: [{
        clientId: "A",
        identity: { username: "alice" },
        presence: { cursor: { x: 1, y: 2 } }
      }]
    }]);
  });

  test("presence updates merge into stored state and broadcast to other members, excluding the sender", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    a.sent.length = 0;
    b.sent.length = 0;

    server.handleMessage("A", {
      room: "pixel-draw",
      kind: "presence",
      patch: { cursor: { x: 5, y: 5 } }
    });

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "peer-presence",
      clientId: "A",
      patch: { cursor: { x: 5, y: 5 } }
    }]);
  });

  test("presence from a client that hasn't joined the room is dropped", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    b.sent.length = 0;

    server.handleMessage("A", {
      room: "pixel-draw",
      kind: "presence",
      patch: { cursor: { x: 5, y: 5 } }
    });

    assert.deepEqual(b.sent, []);
  });

  test("identity and presence are gone from the sync snapshot after leave/disconnect", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const a = createClient("A");
    const b = createClient("B");
    const c = createClient("C");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleConnect(c.client);
    server.handleMessage("A", {
      room: "pixel-draw",
      kind: "join",
      identity: { username: "alice" }
    });
    server.handleMessage("B", {
      room: "pixel-draw",
      kind: "join",
      identity: { username: "bob" }
    });
    server.handleMessage("A", { room: "pixel-draw", kind: "leave" });
    server.handleDisconnect("B");

    server.handleMessage("C", { room: "pixel-draw", kind: "join" });

    assert.deepEqual(c.sent, []);
  });
});

describe("Server — authority broadcast via RoomHandle", () => {
  test("onMessage receives a RoomHandle that broadcasts to every room member, envelope-wrapped like a scoped send", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    server.handleMessage("A", { room: "pixel-draw", kind: "message", payload: {} });
    a.sent.length = 0;
    b.sent.length = 0;

    authority.room?.broadcast({ hello: "world" });

    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    }]);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    }]);
  });

  test("broadcast does not reach clients joined to a different room", () => {
    const server = new Server();
    const pixel = new RecordingAuthority("pixel-draw");
    const voxel = new RecordingAuthority("voxel");
    server.register(pixel);
    server.register(voxel);

    const a = createClient("A");
    server.handleConnect(a.client);
    server.handleMessage("A", { room: "voxel", kind: "join" });

    server.broadcast("pixel-draw", { should: "not arrive" });

    assert.deepEqual(a.sent, []);
  });

  test("broadcast stops reaching a client that left or disconnected", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    server.handleMessage("B", { room: "pixel-draw", kind: "leave" });
    server.handleDisconnect("A");
    a.sent.length = 0;
    b.sent.length = 0;

    server.broadcast("pixel-draw", { hello: "world" });

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, []);
  });
});

describe("Server — external broadcast()", () => {
  test("pushes a room-scoped message to every member from outside the authority flow", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const a = createClient("A");
    server.handleConnect(a.client);
    server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    a.sent.length = 0;

    server.broadcast("pixel-draw", { tick: 1 });

    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "message",
      payload: { tick: 1 }
    }]);
  });

  test("is a no-op before any client has joined the room", () => {
    const server = new Server();
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    assert.doesNotThrow(() => server.broadcast("pixel-draw", { hello: "world" }));
  });

  test("is a no-op for an unregistered room id", () => {
    const server = new Server();

    assert.doesNotThrow(() => server.broadcast("unknown", { hello: "world" }));
  });
});

describe("Server — rights: denied join", () => {
  test("a client denied at join is not tracked as a room member, so later messages/presence never reach the authority", () => {
    const server = new Server({ rights: { viewer: { "pixel-draw.$join": "void" } } });
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const { client, sent } = createClient("A");
    server.handleConnect(client);
    server.handleMessage("A", {
      room: "pixel-draw",
      kind: "join",
      identity: { role: "viewer" }
    });

    assert.deepEqual(authority.connected, []);
    assert.deepEqual(sent, [{
      room: "pixel-draw",
      kind: "denied",
      event: "$join",
      reason: "role \"viewer\" is not permitted to join this room"
    }]);

    server.handleMessage("A", {
      room: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    });
    server.handleMessage("A", {
      room: "pixel-draw",
      kind: "presence",
      patch: { cursor: { x: 1, y: 1 } }
    });

    assert.deepEqual(authority.messages, []);
  });

  test("ServerOptions.rights gates message writes end-to-end, independent of the authority", () => {
    const server = new Server({
      rights: { viewer: { "pixel-draw.voxel-set": "read" } }
    });
    const authority = new RecordingAuthority("pixel-draw");
    server.register(authority);

    const { client, sent } = createClient("A");
    server.handleConnect(client);
    server.handleMessage("A", { room: "pixel-draw", kind: "join", identity: { role: "viewer" } });
    sent.length = 0;

    server.handleMessage("A", {
      room: "pixel-draw",
      kind: "message",
      payload: { action: "voxel-set" }
    });

    assert.deepEqual(authority.messages, []);
    assert.deepEqual(sent, [{
      room: "pixel-draw",
      kind: "denied",
      event: "voxel-set",
      reason: "role \"viewer\" cannot write \"voxel-set\""
    }]);
  });

  test("one rule covers every room registered under the same authority name, regardless of distinct ids", () => {
    const server = new Server({
      rights: { viewer: { "voxel.renderer.voxel-set": "read" } }
    });
    const worldOne = new RecordingAuthority("voxel-map:world-1", "voxel.renderer");
    const worldTwo = new RecordingAuthority("voxel-map:world-2", "voxel.renderer");
    server.register(worldOne);
    server.register(worldTwo);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { room: "voxel-map:world-1", kind: "join", identity: { role: "viewer" } });
    server.handleMessage("B", { room: "voxel-map:world-2", kind: "join", identity: { role: "viewer" } });

    server.handleMessage("A", { room: "voxel-map:world-1", kind: "message", payload: { action: "voxel-set" } });
    server.handleMessage("B", { room: "voxel-map:world-2", kind: "message", payload: { action: "voxel-set" } });

    assert.deepEqual(worldOne.messages, []);
    assert.deepEqual(worldTwo.messages, []);
  });
});
