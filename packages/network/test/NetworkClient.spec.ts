// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { NetworkClient } from "#src/NetworkClient.ts";

type Listener = (event: any) => void;

/**
 * Minimal WebSocket test double: no real networking, just enough of the
 * addEventListener/send/close surface NetworkClient relies on, plus
 * `open()`/`receive()` helpers to drive it from tests.
 */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  url: string;
  sent: string[] = [];
  closed = false;
  #listeners = new Map<string, Listener[]>();

  constructor(
    url: string
  ) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(
    type: string,
    handler: Listener
  ): void {
    const handlers = this.#listeners.get(type) ?? [];
    handlers.push(handler);
    this.#listeners.set(type, handlers);
  }

  send(
    data: string
  ): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  open(): void {
    this.#emit("open", {});
  }

  receive(
    data: unknown
  ): void {
    this.#emit("message", { data: JSON.stringify(data) });
  }

  #emit(
    type: string,
    event: unknown
  ): void {
    for (const handler of this.#listeners.get(type) ?? []) {
      handler(event);
    }
  }
}

const originalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  FakeWebSocket.instances = [];
  // @ts-expect-error - test double, not a full WebSocket implementation
  globalThis.WebSocket = FakeWebSocket;
});

afterEach(() => {
  globalThis.WebSocket = originalWebSocket;
});

function createOpenClient(
  options: ConstructorParameters<typeof NetworkClient>[0] = { url: "ws://localhost/ws-sync" }
): { client: NetworkClient; socket: FakeWebSocket; } {
  const client = new NetworkClient(options);
  const socket = FakeWebSocket.instances[0]!;
  socket.open();

  return { client, socket };
}

describe("NetworkClient — join identity", () => {
  test("includes the connection's identity on every channel's join envelope", () => {
    const { client, socket } = createOpenClient({
      url: "ws://localhost/ws-sync",
      identity: { username: "alice" }
    });

    client.channel("pixel-draw");
    client.channel("voxel-map");

    const joins = socket.sent.map((raw) => JSON.parse(raw));
    assert.deepEqual(joins, [
      { namespace: "pixel-draw", kind: "join", identity: { username: "alice" } },
      { namespace: "voxel-map", kind: "join", identity: { username: "alice" } }
    ]);
  });

  test("defaults to an empty identity when none is provided", () => {
    const { client, socket } = createOpenClient();

    client.channel("pixel-draw");

    assert.deepEqual(
      JSON.parse(socket.sent[0]!),
      { namespace: "pixel-draw", kind: "join", identity: {} }
    );
  });
});

describe("NetworkClient — peers mirror", () => {
  test("populates peers from a sync envelope", () => {
    const { client, socket } = createOpenClient();
    const channel = client.channel("pixel-draw");

    socket.receive({
      namespace: "pixel-draw",
      kind: "sync",
      members: [
        { clientId: "B", identity: { username: "bob" }, presence: { cursor: { x: 1, y: 2 } } }
      ]
    });

    assert.deepEqual([...channel.peers.entries()], [
      ["B", { clientId: "B", identity: { username: "bob" }, presence: { cursor: { x: 1, y: 2 } } }]
    ]);
  });

  test("peer-joined adds to peers and fires onPeerJoined", () => {
    const { client, socket } = createOpenClient();
    const channel = client.channel("pixel-draw");
    const joined: string[] = [];
    channel.onPeerJoined = (clientId) => joined.push(clientId);

    socket.receive({
      namespace: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      identity: { username: "bob" }
    });

    assert.deepEqual(joined, ["B"]);
    assert.deepEqual(channel.peers.get("B"), {
      clientId: "B",
      identity: { username: "bob" },
      presence: {}
    });
  });

  test("peer-left removes from peers and fires onPeerLeft", () => {
    const { client, socket } = createOpenClient();
    const channel = client.channel("pixel-draw");
    const left: string[] = [];
    channel.onPeerLeft = (clientId) => left.push(clientId);

    socket.receive({
      namespace: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      identity: {}
    });
    socket.receive({
      namespace: "pixel-draw",
      kind: "peer-left",
      clientId: "B"
    });

    assert.deepEqual(left, ["B"]);
    assert.equal(channel.peers.has("B"), false);
  });

  test("peer-presence merges into the existing peer's presence and fires onPeerPresence", () => {
    const { client, socket } = createOpenClient();
    const channel = client.channel("pixel-draw");
    const updates: { clientId: string; patch: unknown; }[] = [];
    channel.onPeerPresence = (clientId, patch) => updates.push({ clientId, patch });

    socket.receive({
      namespace: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      identity: { username: "bob" }
    });
    socket.receive({
      namespace: "pixel-draw",
      kind: "peer-presence",
      clientId: "B",
      patch: { cursor: { x: 3, y: 4 } }
    });

    assert.deepEqual(updates, [{ clientId: "B", patch: { cursor: { x: 3, y: 4 } } }]);
    assert.deepEqual(channel.peers.get("B")?.presence, { cursor: { x: 3, y: 4 } });
  });
});

describe("NetworkClient — updatePresence", () => {
  test("sends a presence envelope carrying the patch", () => {
    const { client, socket } = createOpenClient();
    const channel = client.channel("pixel-draw");
    socket.sent.length = 0;

    channel.updatePresence({ cursor: { x: 9, y: 9 } });

    assert.deepEqual(
      socket.sent.map((raw) => JSON.parse(raw)),
      [{ namespace: "pixel-draw", kind: "presence", patch: { cursor: { x: 9, y: 9 } } }]
    );
  });
});
