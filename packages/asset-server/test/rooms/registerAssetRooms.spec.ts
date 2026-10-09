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
  type ServerConnection
} from "@jolly-pixel/network";
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  ASSET_UPDATED,
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
import { recordingLogger } from "../helpers/logger.ts";
import {
  recordingClient,
  type RecordingClient
} from "../helpers/rooms.ts";

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

interface RoomHarness extends AsyncDisposable {
  readonly sync: SyncHarness;
  readonly server: Server;
  readonly catalog: CatalogProjection;
  readonly assetId: string;
  readonly clients: Map<string, RecordingClient>;
  readonly refusals: string[];
  join(clientId: string, room?: string): Promise<ServerConnection>;
  send(clientId: string, payload: unknown): Promise<void>;
}

interface RoomHarnessOptions {
  graceMs?: number;
  kind?: CounterKind;
  handler?: AssetKindHandler<CounterState>;
  extraHandlers?: AssetKindHandler[];
}

function restoringCounterHandler(
  restored: Array<[unknown, number]>
): AssetKindHandler<CounterState> {
  const inner = liveCounterHandler({ delay: 0, maxDelay: 0 });
  const commands = inner.commands!;

  return {
    ...inner,
    commands: {
      ...commands,
      live: (binding) => {
        return {
          ...commands.live!(binding),
          restore: (command, version) => restored.push([command, version])
        };
      }
    }
  };
}

async function roomHarness(
  options: RoomHarnessOptions = {}
): Promise<RoomHarness> {
  const { graceMs = 1_000, kind = "live" } = options;
  const sync = await syncHarness({
    handlers: [
      options.handler ?? counterKinds[kind](),
      ...options.extraHandlers ?? []
    ],
    snapshot: { delay: 0, maxDelay: 0 }
  });

  const created = (await sync.writer.create({
    path: "a.counter",
    data: bytes("0"),
    actor: kActor
  })).unwrap();
  await sync.projector.flush();

  const catalog = new CatalogProjection({ projector: sync.projector });
  catalog.load();
  catalog.start();

  const server = new Server({
    roomGraceMs: graceMs
  });
  const { logger, records } = recordingLogger();
  registerAssetRooms({
    server,
    events: sync.eventStore.writer,
    kinds: sync.kinds,
    catalog,
    states: sync.states,
    flush: async(assetId) => {
      await sync.scheduler.flush(assetId);
      await sync.projector.flush(assetId);
    },
    logger
  });

  const clients = new Map<string, RecordingClient>();
  const connections = new Map<string, ServerConnection>();

  return {
    sync,
    server,
    catalog,
    clients,
    assetId: created.assetId,
    get refusals() {
      return records
        .filter((record) => record.message === "asset room refused")
        .map((record) => record.metadata.reason as string);
    },
    async join(
      clientId,
      room = new AssetRoom("counter", created.assetId).toString()
    ) {
      const handle = recordingClient(clientId);
      clients.set(clientId, handle);
      const connection = server.connect(handle, { subject: handle.id, role: "default" });
      connections.set(clientId, connection);
      await connection.receive({ room, kind: "join" });

      return connection;
    },
    async send(clientId, payload) {
      await connections.get(clientId)?.receive({
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
  test("an unregistered kind is refused", async() => {
    await using harness = await roomHarness();

    await harness.join("A", "voxelmap:whatever");

    assert.deepEqual(harness.refusals, ["unknown kind"]);
    assert.strictEqual(harness.sync.states.has("whatever"), false);
  });

  test("an unknown asset id is refused", async() => {
    await using harness = await roomHarness();

    await harness.join("A", new AssetRoom("counter", "ghost").toString());

    assert.deepEqual(harness.refusals, ["unknown asset"]);
    assert.strictEqual(harness.sync.states.has("ghost"), false);
  });

  test("a kind whose handler builds no extension is refused", async() => {
    await using harness = await roomHarness({ kind: "plain" });

    await harness.join("A");

    assert.deepEqual(harness.refusals, ["kind has no live protocol"]);
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
          data: { value: 0 },
          version: 1
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

  test("a payload the command protocol cannot parse never reaches the room", async() => {
    await using harness = await roomHarness({ kind: "live" });

    await harness.join("A");
    for (const payload of [{ action: "decrement" }, { type: "command" }, null]) {
      await harness.send("A", payload);
    }

    const appended = harness.sync.eventStore.reader
      .list(harness.assetId)
      .filter((event) => event.eventType === COUNTER_INCREMENTED);
    const errors = harness.clients.get("A")!.received
      .filter((envelope) => (envelope as { kind: string; }).kind === "error");

    assert.strictEqual(appended.length, 0);
    assert.strictEqual(errors.length, 3);
  });

  test("an asset id belonging to another live kind is refused", async() => {
    await using harness = await roomHarness({
      extraHandlers: [
        {
          ...liveCounterHandler(),
          kind: "gauge",
          extensions: { ".gauge": "text/plain; charset=utf-8" }
        }
      ]
    });

    await harness.join("A", new AssetRoom("gauge", harness.assetId).toString());

    assert.deepEqual(harness.refusals, ["unknown asset"]);
    assert.strictEqual(harness.sync.states.has(harness.assetId), false);
  });
});

describe("registerAssetRooms — restore", () => {
  test("a cold room restores its arbiter from the replayed commands", async() => {
    const restored: Array<[unknown, number]> = [];
    await using harness = await roomHarness({
      handler: restoringCounterHandler(restored)
    });
    const versions = [1, 2].map(() => harness.sync.eventStore.writer.append({
      assetType: "counter",
      assetId: harness.assetId,
      eventType: COUNTER_INCREMENTED,
      eventData: { action: "increment" },
      actor: kActor
    }).unwrap().eventVersion);

    await harness.join("alice");

    assert.deepEqual(restored, versions.map((version) => [
      { action: "increment" },
      version
    ]));
  });
});

describe("registerAssetRooms — eviction", () => {
  test("expiry flushes the asset before releasing its state", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    await using harness = await roomHarness({ graceMs: 100 });
    const room = new AssetRoom("counter", harness.assetId).toString();

    const connectionA = await harness.join("A");
    await harness.send("A", { action: "increment" });
    await connectionA.receive({ room, kind: "leave" });

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
});

describe("registerAssetRooms — replaced content", () => {
  test("an update from outside the room sends every member the new snapshot", async() => {
    await using harness = await roomHarness();
    const room = new AssetRoom("counter", harness.assetId).toString();
    await harness.join("A");
    await harness.join("B");

    const updated = (await harness.sync.writer.update({
      assetId: harness.assetId,
      data: bytes("7"),
      actor: kActor
    })).unwrap();

    for (const id of ["A", "B"]) {
      assert.deepEqual(harness.clients.get(id)!.received.at(-1), {
        room,
        kind: "message",
        payload: {
          type: "snapshot",
          data: { value: 7 },
          version: updated.eventVersion
        }
      });
    }
  });

  test("a scheduled snapshot of the room's own edits sends no snapshot", async() => {
    await using harness = await roomHarness();
    await harness.join("A");
    await harness.send("A", { action: "increment" });
    const received = harness.clients.get("A")!.received;
    const beforeSnapshot = received.length;

    await harness.sync.scheduler.flush();

    const last = harness.sync.eventStore.reader.list(harness.assetId).at(-1);
    assert.strictEqual(last?.eventType, ASSET_UPDATED);
    assert.strictEqual(received.length, beforeSnapshot);
  });
});
