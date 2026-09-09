// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import {
  Extension,
  Server,
  type ClientHandle,
  type RoomContext
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  counterCommandProtocols,
  counterProtocols
} from "../helpers/protocols.ts";
import {
  assetRoomName,
  CatalogProjection,
  parseAssetRoomName,
  registerAssetRooms,
  type AssetKindHandler,
  type AssetRoomBinding
} from "#src/index.ts";
import { syncHarness, type SyncHarness } from "../helpers/backend.ts";
import {
  counterHandler,
  COUNTER_INCREMENTED,
  type CounterState
} from "../helpers/kinds.ts";
import { bytes } from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

class CounterExtension extends Extension {
  readonly id: string;
  readonly name: string;
  readonly protocols = counterProtocols;
  readonly state: CounterState;
  disposed = 0;

  constructor(
    binding: AssetRoomBinding<CounterState>
  ) {
    super();
    this.id = binding.roomId;
    this.name = binding.kind;
    this.state = binding.state;
  }

  override async onMessage(
    _clientId: string,
    _payload: unknown,
    context: RoomContext
  ): Promise<void> {
    await context.eventStore.append({
      assetType: this.name,
      assetId: this.id.slice(this.name.length + 1),
      eventType: COUNTER_INCREMENTED,
      eventData: {}
    });
  }

  override dispose(): void {
    this.disposed += 1;
  }
}

function editableCounter(): AssetKindHandler<CounterState> {
  const handler = counterHandler({ delay: 0, maxDelay: 0 });

  return {
    ...handler,
    createExtension: (binding) => new CounterExtension(binding)
  };
}

function liveCounter(): AssetKindHandler<CounterState, CounterCommand> {
  const handler = counterHandler({ delay: 0, maxDelay: 0 });

  return {
    ...handler,
    live: (binding) => {
      return {
        commandEventType: COUNTER_INCREMENTED,
        protocols: counterCommandProtocols,
        parse: (payload) => (isCounterCommand(payload) ? payload : null),
        snapshot: () => {
          return { value: binding.state.value };
        },
        arbitrate: (command) => {
          return { command };
        }
      };
    }
  };
}

type CounterKind = "extension" | "live" | "plain";

const counterKinds: Record<CounterKind, () => AssetKindHandler<CounterState>> = {
  extension: editableCounter,
  live: liveCounter,
  plain: () => counterHandler()
};

interface CounterCommand {
  action: "increment";
}

function isCounterCommand(
  payload: unknown
): payload is CounterCommand {
  return typeof payload === "object" &&
    payload !== null &&
    "action" in payload &&
    payload.action === "increment";
}

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
  const { graceMs = 1_000, kind = "extension" } = options;
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
    eventStore: sync.eventStore,
    roomGraceMs: graceMs
  });
  registerAssetRooms({
    server,
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
    async join(clientId, room = assetRoomName("counter", created.assetId)) {
      const handle = client(clientId);
      clients.set(clientId, handle);
      server.handleConnect(handle);
      await server.handleMessage(clientId, { room, kind: "join" });
    },
    send(clientId, payload) {
      return server.handleMessage(clientId, {
        room: assetRoomName("counter", created.assetId),
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

describe("parseAssetRoomName", () => {
  test("splits kind from asset id", () => {
    assert.deepEqual(parseAssetRoomName("pixelart:a1"), {
      kind: "pixelart",
      assetId: "a1"
    });
  });

  test("only the first colon separates", () => {
    assert.deepEqual(parseAssetRoomName("pixelart:a:1"), {
      kind: "pixelart",
      assetId: "a:1"
    });
  });

  test("rejects a name with no separator or an empty half", () => {
    assert.strictEqual(parseAssetRoomName("pixelart"), null);
    assert.strictEqual(parseAssetRoomName(":a1"), null);
    assert.strictEqual(parseAssetRoomName("pixelart:"), null);
  });

  test("assetRoomName is its inverse", () => {
    assert.deepEqual(
      parseAssetRoomName(assetRoomName("pixelart", "a1")),
      { kind: "pixelart", assetId: "a1" }
    );
  });
});

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

    await harness.join("A", assetRoomName("counter", "ghost"));

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
        room: assetRoomName("counter", harness.assetId),
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

    await harness.join("A", assetRoomName("binary", harness.assetId));

    assert.strictEqual(harness.sync.states.has(harness.assetId), false);
  });
});

describe("registerAssetRooms — eviction", () => {
  test("a rejoin inside the grace period keeps the same extension", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    await using harness = await roomHarness({ graceMs: 1_000 });

    await harness.join("A");
    const room = assetRoomName("counter", harness.assetId);
    await harness.server.handleMessage("A", { room, kind: "leave" });

    t.mock.timers.tick(500);
    await harness.join("B");
    t.mock.timers.tick(1_000);

    assert.strictEqual(harness.sync.states.has(harness.assetId), true);
  });

  test("expiry flushes the asset before releasing its state", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    await using harness = await roomHarness({ graceMs: 100 });
    const room = assetRoomName("counter", harness.assetId);

    await harness.join("A");
    await harness.server.handleMessage("A", {
      room,
      kind: "message",
      payload: { increment: true }
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
    const room = assetRoomName("counter", harness.assetId);

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
    const room = assetRoomName("counter", harness.assetId);

    harness.server.handleConnect(client("A"));
    await harness.server.handleMessage("A", {
      room,
      kind: "message",
      payload: {}
    });

    assert.strictEqual(harness.sync.states.has(harness.assetId), false);
  });
});
