// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Server,
  Extension,
  type ClientHandle,
  type RoomResolution
} from "#src/index.ts";

class AssetExtension extends Extension {
  readonly id: string;
  readonly name: string;
  disposed = 0;
  messages: unknown[] = [];

  constructor(
    id: string,
    name: string
  ) {
    super();
    this.id = id;
    this.name = name;
  }

  onClientConnect(): void {
    return void 0;
  }

  onClientDisconnect(): void {
    return void 0;
  }

  onMessage(
    _clientId: string,
    payload: unknown
  ): void {
    this.messages.push(payload);
  }

  override dispose(): void {
    this.disposed += 1;
  }
}

function client(
  id: string
): ClientHandle {
  return { id, send: () => void 0 };
}

interface Harness {
  server: Server;
  created: string[];
  evicted: string[];
  extensions: Map<string, AssetExtension>;
}

function harness(
  options: { graceMs?: number; kinds?: string[]; } = {}
): Harness {
  const created: string[] = [];
  const evicted: string[] = [];
  const extensions = new Map<string, AssetExtension>();
  const kinds = options.kinds ?? ["pixelart"];

  const server = new Server({
    roomGraceMs: options.graceMs ?? 1_000
  });
  server.setRoomResolver((name): RoomResolution | null => {
    const separator = name.indexOf(":");
    if (separator === -1) {
      return null;
    }

    const kind = name.slice(0, separator);
    const assetId = name.slice(separator + 1);
    if (!kinds.includes(kind) || assetId.length === 0) {
      return null;
    }

    created.push(name);
    const extension = new AssetExtension(name, kind);
    extensions.set(name, extension);

    return {
      extension,
      onEvict: () => {
        evicted.push(name);
      }
    };
  });

  return { server, created, evicted, extensions };
}

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function join(
  server: Server,
  clientId: string,
  room: string
): Promise<void> {
  server.handleConnect(client(clientId));
  await server.handleMessage(clientId, { room, kind: "join" });
}

describe("Server — dynamic room resolution", () => {
  test("a join creates the room once and a second joiner reuses it", async() => {
    const { server, created, extensions } = harness();

    await join(server, "A", "pixelart:asset-1");
    const first = extensions.get("pixelart:asset-1");
    await join(server, "B", "pixelart:asset-1");

    assert.deepEqual(created, ["pixelart:asset-1"]);
    assert.strictEqual(extensions.get("pixelart:asset-1"), first);
    await server.close();
  });

  test("an unregistered kind is refused", async() => {
    const { server, created } = harness();

    await join(server, "A", "voxelmap:asset-1");

    assert.deepEqual(created, []);
    await server.close();
  });

  test("a name the resolver rejects is refused", async() => {
    const { server, created } = harness();

    await join(server, "A", "pixelart:");

    assert.deepEqual(created, []);
    await server.close();
  });

  test("a message to a never-joined dynamic room is dropped", async() => {
    const { server, created } = harness();

    server.handleConnect(client("A"));
    await server.handleMessage("A", {
      room: "pixelart:asset-1",
      kind: "message",
      payload: { hello: "world" }
    });

    assert.deepEqual(created, []);
    await server.close();
  });

  test("without a resolver, a join to an unknown room is dropped", async() => {
    const server = new Server();

    server.handleConnect(client("A"));
    await server.handleMessage("A", {
      room: "pixelart:asset-1",
      kind: "join"
    });
    await server.handleMessage("A", {
      room: "pixelart:asset-1",
      kind: "message",
      payload: {}
    });

    await server.close();
  });

  test("a resolver that throws leaves the envelope dropped", async() => {
    const server = new Server();
    server.setRoomResolver(() => {
      throw new Error("resolver exploded");
    });

    server.handleConnect(client("A"));
    await server.handleMessage("A", {
      room: "pixelart:asset-1",
      kind: "join"
    });

    await server.close();
  });

  test("a resolved room routes messages to its extension", async() => {
    const { server, extensions } = harness();

    await join(server, "A", "pixelart:asset-1");
    await server.handleMessage("A", {
      room: "pixelart:asset-1",
      kind: "message",
      payload: { stroke: 1 }
    });

    assert.deepEqual(
      extensions.get("pixelart:asset-1")?.messages,
      [{ stroke: 1 }]
    );
    await server.close();
  });
});

describe("Server — room eviction", () => {
  test("a rejoin inside the grace period keeps the same extension", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { server, created, extensions } = harness({
      graceMs: 1_000
    });

    await join(server, "A", "pixelart:asset-1");
    const first = extensions.get("pixelart:asset-1");
    await server.handleMessage("A", {
      room: "pixelart:asset-1",
      kind: "leave"
    });

    t.mock.timers.tick(500);
    await join(server, "B", "pixelart:asset-1");
    t.mock.timers.tick(1_000);

    assert.deepEqual(created, ["pixelart:asset-1"]);
    assert.strictEqual(extensions.get("pixelart:asset-1"), first);
    assert.strictEqual(first?.disposed, 0);
    await server.close();
  });

  test("expiry flushes once, then disposes", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { server, evicted, extensions } = harness({
      graceMs: 1_000
    });

    await join(server, "A", "pixelart:asset-1");
    const extension = extensions.get("pixelart:asset-1");
    await server.handleMessage("A", {
      room: "pixelart:asset-1",
      kind: "leave"
    });

    t.mock.timers.tick(1_000);
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(evicted, ["pixelart:asset-1"]);
    assert.strictEqual(extension?.disposed, 1);
    await server.close();
  });

  test("a disconnect starts the grace timer too", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { server, evicted } = harness({ graceMs: 1_000 });

    await join(server, "A", "pixelart:asset-1");
    await server.handleDisconnect("A");

    t.mock.timers.tick(1_000);
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(evicted, ["pixelart:asset-1"]);
    await server.close();
  });

  test("a room with members left is not evicted", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { server, evicted } = harness({ graceMs: 1_000 });

    await join(server, "A", "pixelart:asset-1");
    await join(server, "B", "pixelart:asset-1");
    await server.handleMessage("A", {
      room: "pixelart:asset-1",
      kind: "leave"
    });

    t.mock.timers.tick(5_000);

    assert.deepEqual(evicted, []);
    await server.close();
  });

  test("opening and closing the same room repeatedly leaks nothing", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { server, created, evicted } = harness({ graceMs: 100 });

    for (let index = 0; index < 3; index++) {
      await join(server, `client-${index}`, "pixelart:asset-1");
      await server.handleMessage(`client-${index}`, {
        room: "pixelart:asset-1",
        kind: "leave"
      });
      t.mock.timers.tick(100);
      await Promise.resolve();
      await Promise.resolve();
    }

    // a leftover eviction timer would fire here and evict a fourth time
    t.mock.timers.tick(10_000);

    assert.strictEqual(created.length, 3);
    assert.strictEqual(evicted.length, 3);
    await server.close();
  });

  test("close evicts and disposes remaining rooms", async() => {
    const { server, evicted, extensions } = harness({ graceMs: 60_000 });

    await join(server, "A", "pixelart:asset-1");
    const extension = extensions.get("pixelart:asset-1");
    await server.close();

    assert.deepEqual(evicted, ["pixelart:asset-1"]);
    assert.strictEqual(extension?.disposed, 1);
  });

  test("close disposes statically registered rooms too", async() => {
    const server = new Server();
    const extension = new AssetExtension("static-room", "static");
    server.register(extension);

    await server.close();

    assert.strictEqual(extension.disposed, 1);
  });
});

describe("Server — room lifetime regressions", () => {
  test("a stray envelope from a non-member does not keep an empty room alive", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { server, evicted } = harness({ graceMs: 1_000 });

    await join(server, "A", "pixelart:asset-1");
    await server.handleMessage("A", {
      room: "pixelart:asset-1",
      kind: "leave"
    });

    // dropped as "client has not joined room", and must not disarm the timer
    server.handleConnect(client("Z"));
    await server.handleMessage("Z", {
      room: "pixelart:asset-1",
      kind: "message",
      payload: {}
    });

    t.mock.timers.tick(1_000);
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(evicted, ["pixelart:asset-1"]);
    await server.close();
  });

  test("a denied join leaves the room it resolved evictable", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const evicted: string[] = [];
    const server = new Server({
      roomGraceMs: 1_000,
      rights: {
        guest: { "kind.$join": "void" }
      }
    });
    server.setRoomResolver((name): RoomResolution => {
      return {
        extension: new AssetExtension(name, "kind"),
        onEvict: () => {
          evicted.push(name);
        }
      };
    });

    server.handleConnect(client("A"));
    await server.handleMessage("A", {
      room: "kind:asset-1",
      kind: "join",
      identity: { role: "guest" }
    });

    t.mock.timers.tick(1_000);
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(evicted, ["kind:asset-1"]);
    await server.close();
  });

  test("outbound envelopes carry the joined name, not the extension id", async() => {
    const sent: any[] = [];
    const server = new Server();
    server.setRoomResolver((): RoomResolution => {
      return { extension: new AssetExtension("ext-id", "kind") };
    });

    server.handleConnect({ id: "A", send: (data) => sent.push(data) });
    server.handleConnect({ id: "B", send: (data) => sent.push(data) });
    await server.handleMessage("A", { room: "kind:asset-1", kind: "join" });
    await server.handleMessage("B", { room: "kind:asset-1", kind: "join" });

    assert.deepEqual(
      [...new Set(sent.map((envelope) => envelope.room))],
      ["kind:asset-1"]
    );
    await server.close();
  });

  test("a rejoin waits for the previous eviction to flush", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const order: string[] = [];
    let release: (() => void) | null = null;
    const server = new Server({ roomGraceMs: 1_000 });
    server.setRoomResolver((name): RoomResolution => {
      order.push("resolve");

      return {
        extension: new AssetExtension(name, "kind"),
        // one-shot gate: only the first eviction blocks, so close() below
        // is not left waiting on a promise nothing resolves
        onEvict: (): Promise<void> => {
          if (order.includes("evict:start")) {
            return Promise.resolve();
          }
          order.push("evict:start");

          return new Promise<void>((resolve) => {
            release = () => {
              order.push("evict:end");
              resolve();
            };
          });
        }
      };
    });

    await join(server, "A", "pixelart:asset-1");
    await server.handleMessage("A", {
      room: "pixelart:asset-1",
      kind: "leave"
    });

    t.mock.timers.tick(1_000);
    await flush();
    assert.deepEqual(order, ["resolve", "evict:start"]);

    server.handleConnect(client("B"));
    const rejoin = server.handleMessage("B", {
      room: "pixelart:asset-1",
      kind: "join"
    });
    await flush();
    // the resolver must not have run again while the flush is pending
    assert.deepEqual(order, ["resolve", "evict:start"]);

    release!();
    await rejoin;

    assert.deepEqual(
      order,
      ["resolve", "evict:start", "evict:end", "resolve"]
    );

    t.mock.timers.reset();
    await server.close();
  });
});

describe("dynamic rooms — concurrent joins", () => {
  test("a slow resolution does not hold up a join on another room", async() => {
    const order: string[] = [];
    const server = new Server();
    server.setRoomResolver(async(name): Promise<RoomResolution> => {
      if (name === "pixelart:slow") {
        await new Promise((resolve) => {
          setTimeout(resolve, 30);
        });
      }
      order.push(name);

      return { extension: new AssetExtension(name, "pixelart") };
    });

    server.handleConnect(client("A"));
    const slow = server.handleMessage("A", {
      room: "pixelart:slow",
      kind: "join"
    });
    const fast = server.handleMessage("A", {
      room: "pixelart:fast",
      kind: "join"
    });

    await Promise.all([slow, fast]);

    assert.deepEqual(order, ["pixelart:fast", "pixelart:slow"]);
    await server.close();
  });

  test("a message still lands after the join it followed on the same room", async() => {
    const { server, extensions } = harness();
    const room = "pixelart:a1";

    server.handleConnect(client("A"));
    const join = server.handleMessage("A", { room, kind: "join" });
    const message = server.handleMessage("A", {
      room,
      kind: "message",
      payload: { action: "stroke" }
    });

    await Promise.all([join, message]);

    assert.deepEqual(
      extensions.get(room)!.messages,
      [{ action: "stroke" }]
    );
    await server.close();
  });

  test("a disconnect waits for the joins still in flight", async() => {
    const order: string[] = [];
    const server = new Server();
    server.setRoomResolver(async(name): Promise<RoomResolution> => {
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
      const extension = new AssetExtension(name, "pixelart");
      function connect() {
        order.push("join");
      }
      function disconnect() {
        order.push("leave");
      }

      return {
        extension: Object.assign(extension, {
          onClientConnect: connect,
          onClientDisconnect: disconnect
        })
      };
    });

    server.handleConnect(client("A"));
    const join = server.handleMessage("A", {
      room: "pixelart:a1",
      kind: "join"
    });
    await server.handleDisconnect("A");
    await join;

    assert.deepEqual(order, ["join", "leave"]);
    await server.close();
  });
});
