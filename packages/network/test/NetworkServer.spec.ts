// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { NetworkServer } from "#src/NetworkServer.ts";
import { NetworkPlugin } from "#src/NetworkPlugin.ts";
import type { ClientHandle } from "#src/types.ts";

class RecordingPlugin extends NetworkPlugin {
  readonly namespace: string;
  connected: string[] = [];
  disconnected: string[] = [];
  messages: { clientId: string; payload: unknown; }[] = [];
  handles = new Map<string, ClientHandle>();
  broadcast: ((payload: unknown) => void) | undefined;

  constructor(
    namespace: string
  ) {
    super();
    this.namespace = namespace;
  }

  onClientConnect(
    client: ClientHandle
  ): void {
    this.connected.push(client.id);
    this.handles.set(client.id, client);
  }

  onClientDisconnect(
    clientId: string
  ): void {
    this.disconnected.push(clientId);
  }

  onMessage(
    clientId: string,
    payload: unknown
  ): void {
    this.messages.push({ clientId, payload });
  }

  override attach(
    broadcast: (payload: unknown) => void
  ): void {
    this.broadcast = broadcast;
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

describe("NetworkServer", () => {
  test("does not notify a plugin until the client joins its namespace", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const { client } = createClient("A");
    server.handleConnect(client);
    assert.deepEqual(plugin.connected, []);

    server.handleMessage("A", { namespace: "pixel-draw", kind: "join" });
    assert.deepEqual(plugin.connected, ["A"]);
  });

  test("routes messages only to the joined plugin", () => {
    const server = new NetworkServer();
    const pixel = new RecordingPlugin("pixel-draw");
    const voxel = new RecordingPlugin("voxel");
    server.register(pixel);
    server.register(voxel);

    const { client } = createClient("A");
    server.handleConnect(client);
    server.handleMessage("A", { namespace: "pixel-draw", kind: "join" });
    server.handleMessage("A", {
      namespace: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    });
    server.handleMessage("A", {
      namespace: "voxel",
      kind: "message",
      payload: { should: "be dropped" }
    });

    assert.deepEqual(pixel.messages, [{ clientId: "A", payload: { hello: "world" } }]);
    assert.deepEqual(voxel.messages, []);
  });

  test("scoped client.send() auto-tags outgoing payloads with the namespace", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const { client, sent } = createClient("A");
    server.handleConnect(client);
    server.handleMessage("A", { namespace: "pixel-draw", kind: "join" });

    plugin.handles.get("A")?.send({ type: "snapshot" });

    assert.deepEqual(sent, [{
      namespace: "pixel-draw",
      kind: "message",
      payload: { type: "snapshot" }
    }]);
  });

  test("leave notifies the plugin once and stops routing further messages", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const { client } = createClient("A");
    server.handleConnect(client);
    server.handleMessage("A", { namespace: "pixel-draw", kind: "join" });
    server.handleMessage("A", { namespace: "pixel-draw", kind: "leave" });
    server.handleMessage("A", {
      namespace: "pixel-draw",
      kind: "message",
      payload: {}
    });

    assert.deepEqual(plugin.disconnected, ["A"]);
    assert.deepEqual(plugin.messages, []);
  });

  test("disconnect notifies only plugins the client had joined", () => {
    const server = new NetworkServer();
    const pixel = new RecordingPlugin("pixel-draw");
    const voxel = new RecordingPlugin("voxel");
    server.register(pixel);
    server.register(voxel);

    const { client } = createClient("A");
    server.handleConnect(client);
    server.handleMessage("A", { namespace: "pixel-draw", kind: "join" });
    server.handleDisconnect("A");

    assert.deepEqual(pixel.disconnected, ["A"]);
    assert.deepEqual(voxel.disconnected, []);
  });

  test("ignores malformed envelopes and unknown namespaces", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const { client } = createClient("A");
    server.handleConnect(client);

    assert.doesNotThrow(() => {
      server.handleMessage("A", "not an envelope");
      server.handleMessage("A", { namespace: "unknown", kind: "join" });
      server.handleMessage("A", { namespace: "pixel-draw", kind: "message", payload: {} });
    });
    assert.deepEqual(plugin.connected, []);
    assert.deepEqual(plugin.messages, []);
  });
});

describe("NetworkServer — peer presence", () => {
  test("notifies existing namespace members when a new client joins, but not the joiner itself", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);

    server.handleMessage("A", { namespace: "pixel-draw", kind: "join" });
    assert.deepEqual(a.sent, []);

    server.handleMessage("B", { namespace: "pixel-draw", kind: "join" });
    assert.deepEqual(a.sent, [{
      namespace: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      identity: Object.create(null)
    }]);
    assert.deepEqual(b.sent, [{
      namespace: "pixel-draw",
      kind: "sync",
      members: [
        { clientId: "A", identity: Object.create(null), presence: {} }
      ]
    }]);
  });

  test("notifies remaining members on explicit leave, but not the leaver", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { namespace: "pixel-draw", kind: "join" });
    server.handleMessage("B", { namespace: "pixel-draw", kind: "join" });
    a.sent.length = 0;
    b.sent.length = 0;

    server.handleMessage("B", { namespace: "pixel-draw", kind: "leave" });

    assert.deepEqual(a.sent, [{ namespace: "pixel-draw", kind: "peer-left", clientId: "B" }]);
    assert.deepEqual(b.sent, []);
  });

  test("notifies remaining members when a client disconnects", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { namespace: "pixel-draw", kind: "join" });
    server.handleMessage("B", { namespace: "pixel-draw", kind: "join" });
    a.sent.length = 0;

    server.handleDisconnect("B");

    assert.deepEqual(a.sent, [{ namespace: "pixel-draw", kind: "peer-left", clientId: "B" }]);
  });

  test("does not leak peer events across namespaces", () => {
    const server = new NetworkServer();
    const pixel = new RecordingPlugin("pixel-draw");
    const voxel = new RecordingPlugin("voxel");
    server.register(pixel);
    server.register(voxel);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { namespace: "voxel", kind: "join" });

    server.handleMessage("B", { namespace: "pixel-draw", kind: "join" });

    assert.deepEqual(a.sent, []);
  });
});

describe("NetworkServer — peer metadata", () => {
  test("peer-joined sent to existing members includes the joiner's identity", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { namespace: "pixel-draw", kind: "join" });

    server.handleMessage("B", {
      namespace: "pixel-draw",
      kind: "join",
      identity: { username: "bob" }
    });

    assert.deepEqual(a.sent, [{
      namespace: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      identity: { username: "bob" }
    }]);
  });

  test("a joiner with no existing members receives no sync envelope", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const { client, sent } = createClient("A");
    server.handleConnect(client);

    server.handleMessage("A", { namespace: "pixel-draw", kind: "join" });

    assert.deepEqual(sent, []);
  });

  test("a joiner with existing members receives a sync snapshot of their identity and presence", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", {
      namespace: "pixel-draw",
      kind: "join",
      identity: { username: "alice" }
    });
    server.handleMessage("A", {
      namespace: "pixel-draw",
      kind: "presence",
      patch: { cursor: { x: 1, y: 2 } }
    });
    b.sent.length = 0;

    server.handleMessage("B", { namespace: "pixel-draw", kind: "join" });

    assert.deepEqual(b.sent, [{
      namespace: "pixel-draw",
      kind: "sync",
      members: [{
        clientId: "A",
        identity: { username: "alice" },
        presence: { cursor: { x: 1, y: 2 } }
      }]
    }]);
  });

  test("presence updates merge into stored state and broadcast to other members, excluding the sender", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { namespace: "pixel-draw", kind: "join" });
    server.handleMessage("B", { namespace: "pixel-draw", kind: "join" });
    a.sent.length = 0;
    b.sent.length = 0;

    server.handleMessage("A", {
      namespace: "pixel-draw",
      kind: "presence",
      patch: { cursor: { x: 5, y: 5 } }
    });

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      namespace: "pixel-draw",
      kind: "peer-presence",
      clientId: "A",
      patch: { cursor: { x: 5, y: 5 } }
    }]);
  });

  test("presence from a client that hasn't joined the namespace is dropped", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("B", { namespace: "pixel-draw", kind: "join" });
    b.sent.length = 0;

    server.handleMessage("A", {
      namespace: "pixel-draw",
      kind: "presence",
      patch: { cursor: { x: 5, y: 5 } }
    });

    assert.deepEqual(b.sent, []);
  });

  test("identity and presence are gone from the sync snapshot after leave/disconnect", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const a = createClient("A");
    const b = createClient("B");
    const c = createClient("C");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleConnect(c.client);
    server.handleMessage("A", {
      namespace: "pixel-draw",
      kind: "join",
      identity: { username: "alice" }
    });
    server.handleMessage("B", {
      namespace: "pixel-draw",
      kind: "join",
      identity: { username: "bob" }
    });
    server.handleMessage("A", { namespace: "pixel-draw", kind: "leave" });
    server.handleDisconnect("B");

    server.handleMessage("C", { namespace: "pixel-draw", kind: "join" });

    assert.deepEqual(c.sent, []);
  });
});

describe("NetworkServer — plugin broadcast", () => {
  test("register() hands the plugin a broadcast function via attach()", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    assert.strictEqual(typeof plugin.broadcast, "function");
  });

  test("broadcast sends to every member of the plugin's namespace, envelope-wrapped like a scoped send", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { namespace: "pixel-draw", kind: "join" });
    server.handleMessage("B", { namespace: "pixel-draw", kind: "join" });
    a.sent.length = 0;
    b.sent.length = 0;

    plugin.broadcast?.({ hello: "world" });

    assert.deepEqual(a.sent, [{
      namespace: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    }]);
    assert.deepEqual(b.sent, [{
      namespace: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    }]);
  });

  test("broadcast does not reach clients joined to a different namespace", () => {
    const server = new NetworkServer();
    const pixel = new RecordingPlugin("pixel-draw");
    const voxel = new RecordingPlugin("voxel");
    server.register(pixel);
    server.register(voxel);

    const a = createClient("A");
    server.handleConnect(a.client);
    server.handleMessage("A", { namespace: "voxel", kind: "join" });

    pixel.broadcast?.({ should: "not arrive" });

    assert.deepEqual(a.sent, []);
  });

  test("broadcast stops reaching a client that left or disconnected", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client);
    server.handleConnect(b.client);
    server.handleMessage("A", { namespace: "pixel-draw", kind: "join" });
    server.handleMessage("B", { namespace: "pixel-draw", kind: "join" });
    server.handleMessage("B", { namespace: "pixel-draw", kind: "leave" });
    server.handleDisconnect("A");
    a.sent.length = 0;
    b.sent.length = 0;

    plugin.broadcast?.({ hello: "world" });

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, []);
  });

  test("is a no-op before any client has joined the namespace", () => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin("pixel-draw");
    server.register(plugin);

    assert.doesNotThrow(() => plugin.broadcast?.({ hello: "world" }));
  });

  test("registering a plugin without an attach() override does not throw", () => {
    const server = new NetworkServer();
    class MinimalPlugin extends NetworkPlugin {
      readonly namespace = "minimal";
      onClientConnect(): void {
        // no-op: exercises registration without an attach() override
      }

      onClientDisconnect(): void {
        // no-op: exercises registration without an attach() override
      }

      onMessage(): void {
        // no-op: exercises registration without an attach() override
      }
    }

    assert.doesNotThrow(() => server.register(new MinimalPlugin()));
  });
});
