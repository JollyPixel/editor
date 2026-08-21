// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

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
  assetRoomName,
  createAssetWorkspace,
  MemoryAssetSource,
  STATE_GITIGNORE_PATH,
  type AssetKindHandler,
  type AssetRoomBinding
} from "#src/index.ts";
import { tempWorkspace } from "../helpers/tempWorkspace.ts";
import {
  counterHandler,
  type CounterState
} from "../helpers/kinds.ts";
import { bytes } from "../helpers/bytes.ts";

class CounterExtension extends Extension {
  readonly id: string;
  readonly name = "counter";

  constructor(
    binding: AssetRoomBinding<CounterState>
  ) {
    super();
    this.id = binding.roomId;
  }

  onClientConnect(): void {
    return void 0;
  }

  onClientDisconnect(): void {
    return void 0;
  }

  onMessage(
    _clientId: string,
    _payload: unknown,
    _context: RoomContext
  ): void {
    return void 0;
  }
}

function editableCounter(): AssetKindHandler<CounterState> {
  return {
    ...counterHandler(),
    createExtension: (binding) => new CounterExtension(binding)
  };
}

function client(
  id: string
): ClientHandle {
  return { id, send: () => void 0 };
}

describe("createAssetWorkspace", () => {
  test("seeds, catalogs and serves the workspace over one server", async() => {
    await using temporary = await tempWorkspace();
    using eventStore = EventStore.persistence.memory();

    await using workspace = await createAssetWorkspace({
      root: temporary.root,
      eventStore,
      handlers: [editableCounter()],
      seed: {
        "counter.counter": () => bytes("0")
      },
      backend: { watch: false }
    });

    // The seed landed on disk before the first reconciliation.
    assert.strictEqual(
      await fs.readFile(
        path.join(temporary.root, "counter.counter"),
        "utf8"
      ),
      "0"
    );
    assert.strictEqual(workspace.backend.catalog.size, 1);

    const record = workspace.backend.catalog.snapshot().assets[0];
    assert.strictEqual(record.kind, "counter");

    // The asset room resolves through the server the workspace built.
    workspace.server.handleConnect(client("A"));
    const joined = await workspace.server.handleMessage("A", {
      room: assetRoomName(record.kind, record.id),
      kind: "join"
    });
    assert.notStrictEqual(joined, null);
  });

  test("keeps an existing document over its seed", async() => {
    await using temporary = await tempWorkspace();
    using eventStore = EventStore.persistence.memory();

    await fs.writeFile(
      path.join(temporary.root, "counter.counter"),
      bytes("7")
    );

    await using workspace = await createAssetWorkspace({
      root: temporary.root,
      eventStore,
      handlers: [counterHandler()],
      seed: {
        "counter.counter": () => bytes("0")
      },
      backend: { watch: false }
    });

    assert.strictEqual(
      await fs.readFile(
        path.join(temporary.root, "counter.counter"),
        "utf8"
      ),
      "7"
    );
    assert.strictEqual(workspace.backend.catalog.size, 1);
  });

  test("uses the source it is given", async() => {
    using eventStore = EventStore.persistence.memory();
    const source = new MemoryAssetSource();

    await using workspace = await createAssetWorkspace({
      root: "unused-when-a-source-is-given",
      source,
      eventStore,
      seed: {
        "a.png": () => bytes("bytes")
      },
      backend: { watch: false }
    });

    assert.strictEqual(workspace.source, source);
    assert.deepStrictEqual(
      await source.list(),
      ["a.png"]
    );
    // The back-end still writes its own bookkeeping through that source.
    assert.match(
      new TextDecoder().decode(await source.read(STATE_GITIGNORE_PATH)),
      /events\.db/
    );
  });

  test("registers the extensions it is given on the server it built", async() => {
    using eventStore = EventStore.persistence.memory();
    const extension = new CounterExtension({
      assetId: "a1",
      kind: "counter",
      roomId: "static-room",
      state: { value: 0 }
    });

    await using workspace = await createAssetWorkspace({
      root: "unused",
      source: new MemoryAssetSource(),
      eventStore,
      extensions: [extension],
      backend: { watch: false }
    });

    workspace.server.handleConnect(client("A"));
    const joined = await workspace.server.handleMessage("A", {
      room: "static-room",
      kind: "join"
    });

    assert.notStrictEqual(joined, null);
  });

  test("attaches to the server it is given", async() => {
    using eventStore = EventStore.persistence.memory();
    const server = new Server({ eventStore });

    await using workspace = await createAssetWorkspace({
      root: "unused",
      source: new MemoryAssetSource(),
      eventStore,
      server,
      backend: { watch: false }
    });

    assert.strictEqual(workspace.server, server);
  });

  test("leaves an event store it does not own open", async() => {
    using eventStore = EventStore.persistence.memory();

    const workspace = await createAssetWorkspace({
      root: "unused",
      source: new MemoryAssetSource(),
      eventStore,
      backend: { watch: false }
    });
    await workspace.close();

    const appended = eventStore.writer.append({
      assetType: "counter",
      assetId: "a1",
      eventType: "counter.incremented",
      eventData: {},
      actor: { type: "user", id: "tester" }
    });

    assert.ok(appended.ok);
    assert.strictEqual(eventStore.reader.listAll().length, 1);
  });
});
