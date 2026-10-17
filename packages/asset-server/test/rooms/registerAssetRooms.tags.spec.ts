// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { Server, type ServerConnection } from "@jolly-pixel/network";
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  AssetTags,
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
import { recordingClient, type RecordingClient } from "../helpers/rooms.ts";

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
  readonly tags: AssetTags;
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
  async function flush(
    assetId: string
  ): Promise<void> {
    await sync.scheduler.flush(assetId);
    await sync.projector.flush(assetId);
  }
  const tags = new AssetTags({
    eventStore: sync.eventStore,
    projector: sync.projector,
    writer: sync.writer,
    flush,
    objects: sync.objects
  });
  registerAssetRooms({
    server,
    events: sync.eventStore.writer,
    kinds: sync.kinds,
    catalog,
    states: sync.states,
    flush,
    tags,
    logger
  });

  const clients = new Map<string, RecordingClient>();
  const connections = new Map<string, ServerConnection>();

  return {
    sync,
    server,
    catalog,
    tags,
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

describe("registerAssetRooms — tag rooms", () => {
  test("a tag room serves the tagged version and refuses its commands", async() => {
    await using harness = await roomHarness();
    (await harness.tags.create({
      assetId: harness.assetId,
      name: "v1",
      actor: kActor
    })).unwrap();
    await harness.join("A");
    await harness.send("A", { action: "increment" });
    const room = new AssetRoom("counter", harness.assetId, "v1").toString();
    const eventCount = harness.sync.eventStore.reader.list(harness.assetId).length;

    const connection = await harness.join("B", room);
    await connection.receive({
      room,
      kind: "message",
      payload: { action: "increment" }
    });

    const [sync, snapshot, denied] = harness.clients.get("B")!.received;
    assert.deepEqual(
      (sync as { rights: Record<string, string>; }).rights.increment,
      "read"
    );
    assert.deepEqual(snapshot, {
      room,
      kind: "message",
      payload: {
        type: "snapshot",
        data: { value: 0 },
        version: 1
      }
    });
    assert.strictEqual((denied as { kind: string; }).kind, "denied");
    assert.strictEqual(
      harness.sync.eventStore.reader.list(harness.assetId).length,
      eventCount
    );
  });

  test("an unknown tag is refused", async() => {
    await using harness = await roomHarness();

    await harness.join(
      "A",
      new AssetRoom("counter", harness.assetId, "ghost").toString()
    );

    assert.deepEqual(harness.refusals, ["unknown tag"]);
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
