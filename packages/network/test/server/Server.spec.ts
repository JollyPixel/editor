// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  Server,
  Extension,
  type ClientHandle,
  type RoomContext
} from "#src/index.ts";

class RecordingExtension extends Extension {
  readonly id: string;
  readonly name: string;
  connected: string[] = [];
  disconnected: string[] = [];
  messages: { clientId: string; payload: unknown; }[] = [];
  handles = new Map<string, ClientHandle>();
  context: RoomContext | undefined;

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
    context: RoomContext
  ): void {
    this.connected.push(client.id);
    this.handles.set(client.id, client);
    this.context = context;
  }

  onClientDisconnect(
    clientId: string,
    context: RoomContext
  ): void {
    this.disconnected.push(clientId);
    this.context = context;
  }

  onMessage(
    clientId: string,
    payload: unknown,
    context: RoomContext
  ): void {
    this.messages.push({ clientId, payload });
    this.context = context;
  }

  override getEventName(
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
  test("does not notify an extension until the client joins its room", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    server.handleConnect(client);
    assert.deepEqual(extension.connected, []);

    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    assert.deepEqual(extension.connected, ["A"]);
  });

  test("routes messages only to the joined extension", async() => {
    const server = new Server();
    const pixel = new RecordingExtension("pixel-draw");
    const voxel = new RecordingExtension("voxel");
    server.register(pixel);
    server.register(voxel);

    const { client } = createClient("A");
    server.handleConnect(client);
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    });
    await server.handleMessage("A", {
      room: "voxel",
      kind: "message",
      payload: { should: "be dropped" }
    });

    assert.deepEqual(pixel.messages, [{ clientId: "A", payload: { hello: "world" } }]);
    assert.deepEqual(voxel.messages, []);
  });

  test("scoped client.send() auto-tags outgoing payloads with the room", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client, sent } = createClient("A");
    server.handleConnect(client);
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });

    extension.handles.get("A")?.send({ type: "snapshot" });

    assert.deepEqual(sent, [{
      room: "pixel-draw",
      kind: "message",
      payload: { type: "snapshot" }
    }]);
  });

  test("leave notifies the extension once and stops routing further messages", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    server.handleConnect(client);
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    await server.handleMessage("A", { room: "pixel-draw", kind: "leave" });
    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "message",
      payload: {}
    });

    assert.deepEqual(extension.disconnected, ["A"]);
    assert.deepEqual(extension.messages, []);
  });

  test("disconnect notifies only extensions the client had joined", async() => {
    const server = new Server();
    const pixel = new RecordingExtension("pixel-draw");
    const voxel = new RecordingExtension("voxel");
    server.register(pixel);
    server.register(voxel);

    const { client } = createClient("A");
    server.handleConnect(client);
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    await server.handleDisconnect("A");

    assert.deepEqual(pixel.disconnected, ["A"]);
    assert.deepEqual(voxel.disconnected, []);
  });

  test("ignores malformed envelopes and unknown rooms", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    server.handleConnect(client);

    await assert.doesNotReject(async() => {
      await server.handleMessage("A", "not an envelope");
      await server.handleMessage("A", { room: "unknown", kind: "join" });
      await server.handleMessage("A", { room: "pixel-draw", kind: "message", payload: {} });
    });
    assert.deepEqual(extension.connected, []);
    assert.deepEqual(extension.messages, []);
  });
});

describe("Server — peer presence", () => {
  test("notifies existing room members when a new client joins, but not the joiner itself", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);

    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    assert.deepEqual(a.sent, []);

    await server.handleMessage("B", { room: "pixel-draw", kind: "join" });
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

  test("notifies remaining members on explicit leave, but not the leaver", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    await server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    a.sent.length = 0;
    b.sent.length = 0;

    await server.handleMessage("B", { room: "pixel-draw", kind: "leave" });

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "peer-left", clientId: "B" }]);
    assert.deepEqual(b.sent, []);
  });

  test("notifies remaining members when a client disconnects", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    await server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    a.sent.length = 0;

    await server.handleDisconnect("B");

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "peer-left", clientId: "B" }]);
  });

  test("does not leak peer events across rooms", async() => {
    const server = new Server();
    const pixel = new RecordingExtension("pixel-draw");
    const voxel = new RecordingExtension("voxel");
    server.register(pixel);
    server.register(voxel);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    await server.handleMessage("A", { room: "voxel", kind: "join" });

    await server.handleMessage("B", { room: "pixel-draw", kind: "join" });

    assert.deepEqual(a.sent, []);
  });
});

describe("Server — peer metadata", () => {
  test("peer-joined sent to existing members includes the joiner's identity", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });

    await server.handleMessage("B", {
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

  test("a joiner with no existing members receives no sync envelope", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client, sent } = createClient("A");
    server.handleConnect(client);

    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });

    assert.deepEqual(sent, []);
  });

  test("a joiner with existing members receives a sync snapshot of their identity and presence", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "join",
      identity: { username: "alice" }
    });
    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "presence",
      patch: { cursor: { x: 1, y: 2 } }
    });
    b.sent.length = 0;

    await server.handleMessage("B", { room: "pixel-draw", kind: "join" });

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

  test("presence updates merge into stored state and broadcast to other members, excluding the sender", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    await server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    a.sent.length = 0;
    b.sent.length = 0;

    await server.handleMessage("A", {
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

  test("presence from a client that hasn't joined the room is dropped", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    await server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    b.sent.length = 0;

    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "presence",
      patch: { cursor: { x: 5, y: 5 } }
    });

    assert.deepEqual(b.sent, []);
  });

  test("identity and presence are gone from the sync snapshot after leave/disconnect", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    const c = createClient("C");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleConnect(c.client);
    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "join",
      identity: { username: "alice" }
    });
    await server.handleMessage("B", {
      room: "pixel-draw",
      kind: "join",
      identity: { username: "bob" }
    });
    await server.handleMessage("A", { room: "pixel-draw", kind: "leave" });
    await server.handleDisconnect("B");

    await server.handleMessage("C", { room: "pixel-draw", kind: "join" });

    assert.deepEqual(c.sent, []);
  });
});

describe("Server — extension broadcast via RoomContext", () => {
  test(
    "onMessage receives a RoomContext whose room.broadcast reaches every member, envelope-wrapped like a scoped send",
    async() => {
      const server = new Server();
      const extension = new RecordingExtension("pixel-draw");
      server.register(extension);

      const a = createClient("A");
      const b = createClient("B");
      server.handleConnect(a.client);
      server.handleConnect(b.client);
      await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
      await server.handleMessage("B", { room: "pixel-draw", kind: "join" });
      await server.handleMessage("A", { room: "pixel-draw", kind: "message", payload: {} });
      a.sent.length = 0;
      b.sent.length = 0;

      extension.context?.room.broadcast({ hello: "world" });

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
    }
  );
});

describe("Server — rights: denied join", () => {
  test(
    "a client denied at join is not tracked as a room member, so later messages/presence never reach the extension",
    async() => {
      const server = new Server({ rights: { viewer: { "pixel-draw.$join": "void" } } });
      const extension = new RecordingExtension("pixel-draw");
      server.register(extension);

      const { client, sent } = createClient("A");
      server.handleConnect(client);
      await server.handleMessage("A", {
        room: "pixel-draw",
        kind: "join",
        identity: { role: "viewer" }
      });

      assert.deepEqual(extension.connected, []);
      assert.deepEqual(sent, [{
        room: "pixel-draw",
        kind: "denied",
        event: "$join",
        reason: "role \"viewer\" is not permitted to join this room"
      }]);

      await server.handleMessage("A", {
        room: "pixel-draw",
        kind: "message",
        payload: { hello: "world" }
      });
      await server.handleMessage("A", {
        room: "pixel-draw",
        kind: "presence",
        patch: { cursor: { x: 1, y: 1 } }
      });

      assert.deepEqual(extension.messages, []);
    }
  );

  test("ServerOptions.rights gates message writes end-to-end, independent of the extension", async() => {
    const server = new Server({
      rights: { viewer: { "pixel-draw.voxel-set": "read" } }
    });
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client, sent } = createClient("A");
    server.handleConnect(client);
    await server.handleMessage("A", { room: "pixel-draw", kind: "join", identity: { role: "viewer" } });
    sent.length = 0;

    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "message",
      payload: { action: "voxel-set" }
    });

    assert.deepEqual(extension.messages, []);
    assert.deepEqual(sent, [{
      room: "pixel-draw",
      kind: "denied",
      event: "voxel-set",
      reason: "role \"viewer\" cannot write \"voxel-set\""
    }]);
  });

  test("one rule covers every room registered under the same extension name, regardless of distinct ids", async() => {
    const server = new Server({
      rights: { viewer: { "voxel.renderer.voxel-set": "read" } }
    });
    const worldOne = new RecordingExtension("voxel-map:world-1", "voxel.renderer");
    const worldTwo = new RecordingExtension("voxel-map:world-2", "voxel.renderer");
    server.register(worldOne);
    server.register(worldTwo);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    await server.handleMessage("A", { room: "voxel-map:world-1", kind: "join", identity: { role: "viewer" } });
    await server.handleMessage("B", { room: "voxel-map:world-2", kind: "join", identity: { role: "viewer" } });

    await server.handleMessage("A", { room: "voxel-map:world-1", kind: "message", payload: { action: "voxel-set" } });
    await server.handleMessage("B", { room: "voxel-map:world-2", kind: "message", payload: { action: "voxel-set" } });

    assert.deepEqual(worldOne.messages, []);
    assert.deepEqual(worldTwo.messages, []);
  });
});

describe("Server — event store", () => {
  test("defaults to an in-memory store shared by every registered room", async() => {
    const server = new Server();
    const pixel = new RecordingExtension("pixel-draw");
    const voxel = new RecordingExtension("voxel");
    server.register(pixel);
    server.register(voxel);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    await server.handleMessage("B", { room: "voxel", kind: "join" });

    await pixel.context?.eventStore.append({
      assetType: "texture", assetId: "asset-1", eventType: "pixel-set", eventData: { x: 1 }
    });

    // Read back through the *other* room's context: same Server, one shared EventStore.
    assert.deepEqual(
      (await voxel.context?.eventStore.list("asset-1"))?.map((event) => event.eventData),
      [{ x: 1 }]
    );
  });

  test("uses the EventStore passed via ServerOptions instead of the default", async() => {
    const eventStore = EventStore.persistence.memory();
    const server = new Server({ eventStore });
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    server.handleConnect(client);
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });

    await extension.context?.eventStore.append({
      assetType: "texture", assetId: "asset-1", eventType: "pixel-set", eventData: { x: 1 }
    });

    assert.deepEqual(
      eventStore.reader.list("asset-1").map((event) => event.eventData),
      [{ x: 1 }]
    );
  });
});
