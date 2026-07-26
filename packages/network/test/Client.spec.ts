// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Client } from "#src/index.ts";

type Listener = (event: any) => void;

/**
 * Minimal WebSocket test double: no real networking, just enough of the
 * addEventListener/send/close surface Client relies on, plus
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
  options: ConstructorParameters<typeof Client>[0] = { url: "ws://localhost/ws-sync" }
): { client: Client; socket: FakeWebSocket; } {
  const client = new Client(options);
  const socket = FakeWebSocket.instances[0]!;
  socket.open();

  return { client, socket };
}

describe("Client — ready", () => {
  test("ready is false until the socket opens, then dispatches a \"ready\" event", () => {
    const client = new Client({ url: "ws://localhost/ws-sync" });
    const socket = FakeWebSocket.instances[0]!;

    assert.equal(client.ready, false);

    let fired = 0;
    client.addEventListener("ready", () => {
      fired++;
    });
    socket.open();

    assert.equal(client.ready, true);
    assert.equal(fired, 1);
  });

  test("queued messages flush before \"ready\" fires", () => {
    const client = new Client({ url: "ws://localhost/ws-sync" });
    const socket = FakeWebSocket.instances[0]!;
    client.room("pixel-draw").join();

    let sentBeforeReady = -1;
    client.addEventListener("ready", () => {
      sentBeforeReady = socket.sent.length;
    });
    socket.open();

    assert.equal(sentBeforeReady, 1);
  });
});

describe("Client — join identity", () => {
  test("includes the connection's identity on every room's join envelope", () => {
    const { client, socket } = createOpenClient({
      url: "ws://localhost/ws-sync",
      identity: { username: "alice" }
    });

    client.room("pixel-draw").join();
    client.room("voxel-map").join();

    const joins = socket.sent.map((raw) => JSON.parse(raw));
    assert.deepEqual(joins, [
      { room: "pixel-draw", kind: "join", identity: { username: "alice" } },
      { room: "voxel-map", kind: "join", identity: { username: "alice" } }
    ]);
  });

  test("defaults to an empty identity when none is provided", () => {
    const { client, socket } = createOpenClient();

    client.room("pixel-draw").join();

    assert.deepEqual(
      JSON.parse(socket.sent[0]!),
      { room: "pixel-draw", kind: "join", identity: {} }
    );
  });
});

describe("Client — peers mirror", () => {
  test("populates peers from a sync envelope", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");

    socket.receive({
      room: "pixel-draw",
      kind: "sync",
      members: [
        { clientId: "B", identity: { username: "bob" }, presence: { cursor: { x: 1, y: 2 } } }
      ]
    });

    assert.deepEqual([...room.peers.entries()], [
      ["B", { clientId: "B", identity: { username: "bob" }, presence: { cursor: { x: 1, y: 2 } } }]
    ]);
  });

  test("peer-joined adds to peers and fires \"peer-joined\"", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    const joined: string[] = [];
    room.addEventListener("peer-joined", (event) => joined.push(event.detail.clientId));

    socket.receive({
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      identity: { username: "bob" }
    });

    assert.deepEqual(joined, ["B"]);
    assert.deepEqual(room.peers.get("B"), {
      clientId: "B",
      identity: { username: "bob" },
      presence: {}
    });
  });

  test("peer-left removes from peers and fires \"peer-left\"", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    const left: string[] = [];
    room.addEventListener("peer-left", (event) => left.push(event.detail.clientId));

    socket.receive({
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      identity: {}
    });
    socket.receive({
      room: "pixel-draw",
      kind: "peer-left",
      clientId: "B"
    });

    assert.deepEqual(left, ["B"]);
    assert.equal(room.peers.has("B"), false);
  });

  test("peer-presence merges into the existing peer's presence and fires \"peer-presence\"", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    const updates: { clientId: string; patch: unknown; }[] = [];
    room.addEventListener("peer-presence", (event) => updates.push({
      clientId: event.detail.clientId,
      patch: event.detail.patch
    }));

    socket.receive({
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      identity: { username: "bob" }
    });
    socket.receive({
      room: "pixel-draw",
      kind: "peer-presence",
      clientId: "B",
      patch: { cursor: { x: 3, y: 4 } }
    });

    assert.deepEqual(updates, [{ clientId: "B", patch: { cursor: { x: 3, y: 4 } } }]);
    assert.deepEqual(room.peers.get("B")?.presence, { cursor: { x: 3, y: 4 } });
  });
});

describe("Client — default url", () => {
  const originalLocation = globalThis.location;

  afterEach(() => {
    globalThis.location = originalLocation;
  });

  test("derives a ws:// url from location when none is provided", () => {
    // @ts-expect-error - partial Location stub, only protocol/host are read
    globalThis.location = { protocol: "http:", host: "localhost:5173" };

    new Client({});
    const socket = FakeWebSocket.instances[0]!;

    assert.equal(socket.url, "ws://localhost:5173/ws-sync");
  });

  test("derives a wss:// url from location when the page is https", () => {
    // @ts-expect-error - partial Location stub, only protocol/host are read
    globalThis.location = { protocol: "https:", host: "example.com" };

    new Client({});
    const socket = FakeWebSocket.instances[0]!;

    assert.equal(socket.url, "wss://example.com/ws-sync");
  });
});

describe("Client — updatePresence", () => {
  test("sends a presence envelope carrying the patch", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    socket.sent.length = 0;

    room.updatePresence({ cursor: { x: 9, y: 9 } });

    assert.deepEqual(
      socket.sent.map((raw) => JSON.parse(raw)),
      [{ room: "pixel-draw", kind: "presence", patch: { cursor: { x: 9, y: 9 } } }]
    );
  });
});
