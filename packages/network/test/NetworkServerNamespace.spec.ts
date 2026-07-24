// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { NetworkServerNamespace } from "#src/NetworkServerNamespace.ts";
import { NetworkPlugin } from "#src/NetworkPlugin.ts";
import type { ClientHandle } from "#src/types.ts";

class RecordingPlugin extends NetworkPlugin {
  readonly namespace = "pixel-draw";
  connected: string[] = [];
  disconnected: string[] = [];
  messages: { clientId: string; payload: unknown; }[] = [];
  handles = new Map<string, ClientHandle>();

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

function createNamespace(
  plugin: NetworkPlugin,
  clients: Map<string, ClientHandle>
): NetworkServerNamespace {
  return new NetworkServerNamespace(
    plugin,
    (clientId) => clients.get(clientId)
  );
}

describe("NetworkServerNamespace", () => {
  test("join notifies existing members but not the joiner itself", () => {
    const plugin = new RecordingPlugin();
    const a = createClient("A");
    const b = createClient("B");
    const clients = new Map([["A", a.client], ["B", b.client]]);
    const namespace = createNamespace(plugin, clients);

    namespace.join("A", a.client, {});
    assert.deepEqual(a.sent, []);

    namespace.join("B", b.client, { username: "bob" });
    assert.deepEqual(a.sent, [{
      namespace: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      identity: { username: "bob" }
    }]);
    assert.deepEqual(plugin.connected, ["A", "B"]);
  });

  test("join sends a sync snapshot of pre-existing members to the joiner, omitted when there are none", () => {
    const plugin = new RecordingPlugin();
    const a = createClient("A");
    const b = createClient("B");
    const clients = new Map([["A", a.client], ["B", b.client]]);
    const namespace = createNamespace(plugin, clients);

    namespace.join("A", a.client, { username: "alice" });
    assert.deepEqual(a.sent, []);

    namespace.join("B", b.client, {});
    assert.deepEqual(b.sent, [{
      namespace: "pixel-draw",
      kind: "sync",
      members: [{ clientId: "A", identity: { username: "alice" }, presence: {} }]
    }]);
  });

  test("scoped client passed to onClientConnect auto-tags send() with the namespace", () => {
    const plugin = new RecordingPlugin();
    const a = createClient("A");
    const clients = new Map([["A", a.client]]);
    const namespace = createNamespace(plugin, clients);

    namespace.join("A", a.client, {});
    plugin.handles.get("A")?.send({ type: "snapshot" });

    assert.deepEqual(a.sent, [{
      namespace: "pixel-draw",
      kind: "message",
      payload: { type: "snapshot" }
    }]);
  });

  test("leave broadcasts peer-left to remaining members, excluding the leaver, and notifies the plugin", () => {
    const plugin = new RecordingPlugin();
    const a = createClient("A");
    const b = createClient("B");
    const clients = new Map([["A", a.client], ["B", b.client]]);
    const namespace = createNamespace(plugin, clients);
    namespace.join("A", a.client, {});
    namespace.join("B", b.client, {});
    a.sent.length = 0;
    b.sent.length = 0;

    namespace.leave("B");

    assert.deepEqual(a.sent, [{ namespace: "pixel-draw", kind: "peer-left", clientId: "B" }]);
    assert.deepEqual(b.sent, []);
    assert.deepEqual(plugin.disconnected, ["B"]);
  });

  test("updatePresence merges into stored state and broadcasts to other members, excluding the sender", () => {
    const plugin = new RecordingPlugin();
    const a = createClient("A");
    const b = createClient("B");
    const clients = new Map([["A", a.client], ["B", b.client]]);
    const namespace = createNamespace(plugin, clients);
    namespace.join("A", a.client, {});
    namespace.join("B", b.client, {});
    a.sent.length = 0;
    b.sent.length = 0;

    namespace.updatePresence("A", { cursor: { x: 5, y: 5 } });

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      namespace: "pixel-draw",
      kind: "peer-presence",
      clientId: "A",
      patch: { cursor: { x: 5, y: 5 } }
    }]);
  });

  test("updatePresence for an unknown member is a no-op", () => {
    const plugin = new RecordingPlugin();
    const namespace = createNamespace(plugin, new Map());

    assert.doesNotThrow(() => namespace.updatePresence("A", { cursor: { x: 1, y: 1 } }));
  });

  test("message forwards clientId and payload to the plugin", () => {
    const plugin = new RecordingPlugin();
    const namespace = createNamespace(plugin, new Map());

    namespace.message("A", { hello: "world" });

    assert.deepEqual(plugin.messages, [{ clientId: "A", payload: { hello: "world" } }]);
  });

  test("broadcast sends to every current member, envelope-wrapped like a scoped send", () => {
    const plugin = new RecordingPlugin();
    const a = createClient("A");
    const b = createClient("B");
    const clients = new Map([["A", a.client], ["B", b.client]]);
    const namespace = createNamespace(plugin, clients);
    namespace.join("A", a.client, {});
    namespace.join("B", b.client, {});
    a.sent.length = 0;
    b.sent.length = 0;

    namespace.broadcast({ hello: "world" });

    assert.deepEqual(a.sent, [{ namespace: "pixel-draw", kind: "message", payload: { hello: "world" } }]);
    assert.deepEqual(b.sent, [{ namespace: "pixel-draw", kind: "message", payload: { hello: "world" } }]);
  });

  test("broadcast is a no-op before any client has joined", () => {
    const plugin = new RecordingPlugin();
    const namespace = createNamespace(plugin, new Map());

    assert.doesNotThrow(() => namespace.broadcast({ hello: "world" }));
  });
});
