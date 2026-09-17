// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import {
  Server,
  type ClientHandle
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  AssetRoom,
  CatalogProjection,
  registerAssetRooms,
  type AssetKindHandler
} from "#src/index.ts";
import { syncHarness, type SyncHarness } from "../helpers/backend.ts";
import {
  counterHandler,
  liveCounterHandler,
  COUNTER_INCREMENTED,
  type CounterState
} from "../helpers/kinds.ts";
import { bytes } from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

type CounterKind = "live" | "plain";

const counterKinds: Record<CounterKind, () => AssetKindHandler<CounterState>> = {
  live: () => liveCounterHandler({ delay: 0, maxDelay: 0 }),
  plain: () => counterHandler()
};

function client(
  id: string
): ClientHandle & { received: unknown[]; } {
  const received: unknown[] = [];

  return {
    id,
    received,
    send: (payload) => received.push(payload)
  };
}

interface RoomHarness extends AsyncDisposable {
  readonly sync: SyncHarness;
  readonly server: Server;
  readonly catalog: CatalogProjection;
  readonly assetId: string;
  readonly clients: Map<string, ClientHandle & { received: unknown[]; }>;
  join(clientId: string, room?: string): Promise<void>;
  send(clientId: string, payload: unknown): Promise<void>;
}

async function roomHarness(
  options: { graceMs?: number; kind?: CounterKind; } = {}
): Promise<RoomHarness> {
  const { graceMs = 1_000, kind = "live" } = options;
  const sync = await syncHarness({
    handlers: [counterKinds[kind]()],
    snapshot: { delay: 0, maxDelay: 0 }
  });

  const created = (await sync.writer.create({
    path: "a.counter",
    data: bytes("0"),
    actor: kActor
  })).unwrap();
  await sync.projector.flush();

  const catalog = new CatalogProjection({ eventStore: sync.eventStore });
  catalog.load();
  catalog.start();

  const server = new Server({
    roomGraceMs: graceMs
  });
  registerAssetRooms({
    server,
    events: sync.eventStore.writer,
    kinds: sync.kinds,
    catalog,
    states: sync.states,
    projector: sync.projector,
    scheduler: sync.scheduler
  });

  const clients = new Map<string, ClientHandle & { received: unknown[]; }>();

  return {
    sync,
    server,
    catalog,
    clients,
    assetId: created.assetId,
    async join(
      clientId,
      room = new AssetRoom("counter", created.assetId).toString()
    ) {
      const handle = client(clientId);
      clients.set(clientId, handle);
      server.handleConnect(handle, { subject: handle.id, role: "default" });
      await server.handleMessage(clientId, { room, kind: "join" });
    },
    send(clientId, payload) {
      return server.handleMessage(clientId, {
        room: new AssetRoom("counter", created.assetId).toString(),
        kind: "message",
        payload
      });
    },
    async [Symbol.asyncDispose]() {
      await server.close();
      catalog.close();
      await sync[Symbol.asyncDispose]();
    }
  };
}

describe("registerAssetRooms — admission", () => {
  test("joining an asset room creates one room reused by a second joiner", async() => {
    await using harness = await roomHarness();

    await harness.join("A");
    await harness.join("B");

    assert.strictEqual(harness.sync.states.has(harness.assetId), true);
  });

  test("an unregistered kind is refused", async() => {
    await using harness = await roomHarness();

    await harness.join("A", "voxelmap:whatever");

    assert.strictEqual(harness.sync.states.has("whatever"), false);
  });

  test("an unknown asset id is refused", async() => {
    await using harness = await roomHarness();

    await harness.join("A", new AssetRoom("counter", "ghost").toString());

    assert.strictEqual(harness.sync.states.has("ghost"), false);
  });

  test("a kind whose handler builds no extension is refused", async() => {
    await using harness = await roomHarness({ kind: "plain" });

    await harness.join("A");

    assert.strictEqual(harness.sync.states.has(harness.assetId), false);
  });

  test("a kind exposing a live protocol is hosted by the room extension", async() => {
    await using harness = await roomHarness({ kind: "live" });

    await harness.join("A");

    assert.strictEqual(harness.sync.states.has(harness.assetId), true);
    assert.deepEqual(
      harness.clients.get("A")!.received.at(-1),
      {
        room: new AssetRoom("counter", harness.assetId).toString(),
        kind: "message",
        payload: {
          type: "snapshot",
          data: { value: 0 }
        }
      }
    );
  });

  test("a live protocol appends its command event type", async() => {
    await using harness = await roomHarness({ kind: "live" });

    await harness.join("A");
    await harness.send("A", { action: "increment" });
    await harness.send("A", { action: "decrement" });

    const appended = harness.sync.eventStore.reader
      .list(harness.assetId)
      .filter((event) => event.eventType === COUNTER_INCREMENTED);

    assert.strictEqual(appended.length, 1);
  });

  test("an asset id belonging to another kind is refused", async() => {
    await using harness = await roomHarness();

    await harness.join("A", new AssetRoom("binary", harness.assetId).toString());

    assert.strictEqual(harness.sync.states.has(harness.assetId), false);
  });
});

describe("registerAssetRooms — eviction", () => {
  test("a rejoin inside the grace period keeps the same extension", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    await using harness = await roomHarness({ graceMs: 1_000 });

    await harness.join("A");
    const room = new AssetRoom("counter", harness.assetId).toString();
    await harness.server.handleMessage("A", { room, kind: "leave" });

    t.mock.timers.tick(500);
    await harness.join("B");
    t.mock.timers.tick(1_000);

    assert.strictEqual(harness.sync.states.has(harness.assetId), true);
  });

  test("expiry flushes the asset before releasing its state", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    await using harness = await roomHarness({ graceMs: 100 });
    const room = new AssetRoom("counter", harness.assetId).toString();

    await harness.join("A");
    await harness.server.handleMessage("A", {
      room,
      kind: "message",
      payload: { action: "increment" }
    });
    await harness.server.handleMessage("A", { room, kind: "leave" });

    t.mock.timers.tick(100);
    await harness.server.settled(room);

    assert.strictEqual(
      new TextDecoder().decode(
        await harness.sync.source.read("a.counter")
      ),
      "1"
    );
    assert.strictEqual(harness.sync.states.has(harness.assetId), false);
  });

  test("opening and closing the same asset room repeatedly leaks nothing", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    await using harness = await roomHarness({ graceMs: 100 });
    const room = new AssetRoom("counter", harness.assetId).toString();

    for (let index = 0; index < 3; index++) {
      await harness.join(`client-${index}`);
      await harness.server.handleMessage(`client-${index}`, {
        room,
        kind: "leave"
      });
      t.mock.timers.tick(100);
      await harness.server.settled(room);
    }

    assert.strictEqual(harness.sync.states.has(harness.assetId), false);

    // Nothing is left armed: a later jump evicts nothing new.
    t.mock.timers.tick(10_000);
    await harness.server.settled();

    assert.strictEqual(harness.sync.states.has(harness.assetId), false);
  });

  test("a message from a client that never joined is dropped", async() => {
    await using harness = await roomHarness();
    const room = new AssetRoom("counter", harness.assetId).toString();

    harness.server.handleConnect(client("A"), { subject: "A", role: "default" });
    await harness.server.handleMessage("A", {
      room,
      kind: "message",
      payload: {}
    });

    assert.strictEqual(harness.sync.states.has(harness.assetId), false);
  });
});

describe("registerAssetRooms — deletion", () => {
  test("deleting an asset notifies the members of its open room", async() => {
    await using harness = await roomHarness();
    const room = new AssetRoom("counter", harness.assetId).toString();
    await harness.join("A");

    (await harness.sync.writer.remove({
      assetId: harness.assetId,
      actor: kActor
    })).unwrap();

    assert.deepEqual(harness.clients.get("A")!.received.at(-1), {
      room,
      kind: "message",
      payload: { type: "deleted" }
    });
  });

  test("a room whose asset was deleted appends no further commands", async() => {
    await using harness = await roomHarness();
    await harness.join("A");
    (await harness.sync.writer.remove({
      assetId: harness.assetId,
      actor: kActor
    })).unwrap();

    await harness.send("A", { action: "increment" });

    const appended = harness.sync.eventStore.reader
      .list(harness.assetId)
      .filter((event) => event.eventType === COUNTER_INCREMENTED);
    assert.strictEqual(appended.length, 0);
  });
});
