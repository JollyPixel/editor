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
import { FilesystemAssetSource } from "@jolly-pixel/asset-source";
import {
  Server,
  type ClientHandle
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  assetRoomName,
  createAssetBackend,
  createCatalogHandler,
  encodeContent,
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_DELETE,
  CATALOG_ROOM,
  IDENTITY_SIDECAR_PATH,
  PROJECTION_STATE_PATH,
  STATE_GITIGNORE_PATH
} from "#src/index.ts";
import { tempWorkspace } from "./helpers/tempWorkspace.ts";
import { liveCounterHandler } from "./helpers/kinds.ts";
import { bytes } from "./helpers/bytes.ts";

function client(
  id: string
): ClientHandle {
  return { id, send: () => void 0 };
}

function recorder(
  id: string
): ClientHandle & { received: unknown[]; } {
  const received: unknown[] = [];

  return {
    id,
    received,
    send: (payload) => received.push(payload)
  };
}

async function catalogOverHttp(
  handler: ReturnType<typeof createCatalogHandler>
): Promise<unknown> {
  const headers = new Map<string, string>();
  const chunks: string[] = [];
  const response = {
    statusCode: 0,
    setHeader: (key: string, value: string) => headers.set(key, value),
    end: (payload?: string) => {
      if (payload !== undefined) {
        chunks.push(payload);
      }
    }
  };

  handler(
    { url: "/__jollypixel/catalog", method: "GET" } as never,
    response as never,
    () => {
      throw new Error("handler did not claim the request");
    }
  );

  assert.strictEqual(response.statusCode, 200);

  return JSON.parse(chunks.join(""));
}

describe("asset-server — end to end", () => {
  test("cold start, live edit, external drift and catalog agree", async(t) => {
    await using workspace = await tempWorkspace();
    using eventStore = EventStore.persistence.memory();

    // A workspace populated before the back-end ever ran.
    await fs.writeFile(
      path.join(workspace.root, "counter.counter"),
      bytes("0")
    );
    await fs.mkdir(path.join(workspace.root, "textures"));
    await fs.writeFile(
      path.join(workspace.root, "textures", "grass.png"),
      bytes("grass")
    );

    const source = new FilesystemAssetSource(workspace.root);
    t.mock.timers.enable({ apis: ["setTimeout"] });
    await using backend = await createAssetBackend({
      source,
      eventStore,
      handlers: [liveCounterHandler()],
      snapshot: { delay: 1_000, maxDelay: 5_000 },
      watch: false
    });

    // Cold start cataloged both files and picked their kinds.
    assert.strictEqual(backend.catalog.size, 2);
    const counterRecord = backend.catalog
      .snapshot().assets
      .find((record) => record.source === "counter.counter")!;
    assert.strictEqual(counterRecord.kind, "counter");
    assert.strictEqual(
      backend.catalog.snapshot().assets
        .find((record) => record.source === "textures/grass.png")?.kind,
      "binary"
    );

    // The sidecar and the local state landed, gitignored.
    assert.match(
      await fs.readFile(
        path.join(workspace.root, IDENTITY_SIDECAR_PATH),
        "utf8"
      ),
      /"assets"/
    );
    assert.match(
      await fs.readFile(
        path.join(workspace.root, STATE_GITIGNORE_PATH),
        "utf8"
      ),
      /state\.json/
    );
    assert.match(
      await fs.readFile(
        path.join(workspace.root, PROJECTION_STATE_PATH),
        "utf8"
      ),
      /"checkpoints"/
    );

    // An editor session over a dynamic room.
    const server = new Server({ eventStore });
    backend.attach(server);
    const room = assetRoomName("counter", counterRecord.id);

    server.handleConnect(client("A"), { subject: "A", role: "default" });
    await server.handleMessage("A", { room, kind: "join" });
    for (let index = 0; index < 3; index++) {
      await server.handleMessage("A", {
        room,
        kind: "message",
        payload: { action: "increment" }
      });
    }

    // Domain events alone leave the file untouched until a snapshot.
    assert.strictEqual(
      await fs.readFile(
        path.join(workspace.root, "counter.counter"),
        "utf8"
      ),
      "0"
    );

    t.mock.timers.tick(1_000);
    await backend.flush(counterRecord.id);

    assert.strictEqual(
      await fs.readFile(
        path.join(workspace.root, "counter.counter"),
        "utf8"
      ),
      "3"
    );

    // An external tool edits a file behind the back-end's back.
    await fs.writeFile(
      path.join(workspace.root, "textures", "grass.png"),
      bytes("grass-edited")
    );
    await fs.rm(path.join(workspace.root, "textures", "grass.png"));
    await fs.writeFile(
      path.join(workspace.root, "textures", "dirt.png"),
      bytes("grass-edited")
    );
    (await backend.internals.reconciler.reconcile()).unwrap();
    await backend.internals.projector.flush();

    const drifted = backend.catalog.snapshot().assets
      .find((record) => record.kind === "binary")!;
    assert.strictEqual(drifted.source, "textures/dirt.png");
    assert.deepEqual(
      eventStore.reader.listAll({ eventTypePrefix: "asset." }).at(-1)!.actor,
      { type: "system", source: "fs-watcher" }
    );

    // The HTTP snapshot matches the projection and the filesystem.
    const overHttp = await catalogOverHttp(
      createCatalogHandler({ projection: backend.catalog })
    );
    assert.deepEqual(overHttp, JSON.parse(
      JSON.stringify(backend.catalog.snapshot())
    ));
    assert.deepEqual(
      backend.catalog.snapshot().assets
        .map((record) => record.source)
        .sort(),
      (await source.list()).sort()
    );

    await server.close();
  });

  test("a restart over the same workspace emits no new lifecycle events", async() => {
    await using workspace = await tempWorkspace();
    using eventStore = EventStore.persistence.memory();

    await fs.writeFile(path.join(workspace.root, "a.png"), bytes("one"));
    const source = new FilesystemAssetSource(workspace.root);

    {
      await using backend = await createAssetBackend({
        source,
        eventStore,
        watch: false
      });
      assert.strictEqual(backend.catalog.size, 1);
    }

    const before = eventStore.reader
      .listAll({ eventTypePrefix: "asset." }).length;

    await using restarted = await createAssetBackend({
      source: new FilesystemAssetSource(workspace.root),
      eventStore,
      watch: false
    });

    assert.strictEqual(
      eventStore.reader.listAll({ eventTypePrefix: "asset." }).length,
      before
    );
    assert.strictEqual(restarted.catalog.size, 1);
  });

  test("catalog commands from a client reach disk, peers and open rooms", async() => {
    await using workspace = await tempWorkspace();
    using eventStore = EventStore.persistence.memory();

    await fs.writeFile(path.join(workspace.root, "a.counter"), bytes("0"));
    await using backend = await createAssetBackend({
      source: new FilesystemAssetSource(workspace.root),
      eventStore,
      handlers: [liveCounterHandler()],
      watch: false
    });
    const server = new Server({ eventStore });
    backend.attach(server);

    const author = recorder("A");
    const peer = recorder("B");
    for (const handle of [author, peer]) {
      server.handleConnect(handle, { subject: handle.id, role: "default" });
      await server.handleMessage(handle.id, { room: CATALOG_ROOM, kind: "join" });
    }

    await server.handleMessage("A", {
      room: CATALOG_ROOM,
      kind: "message",
      payload: {
        type: CATALOG_CREATE,
        requestId: "r1",
        path: "textures/grass.png",
        content: encodeContent(bytes("grass"))
      }
    });
    await backend.flush();

    assert.strictEqual(
      await fs.readFile(path.join(workspace.root, "textures", "grass.png"), "utf8"),
      "grass"
    );
    const changed = peer.received.at(-1) as {
      payload: { type: string; change: { record: { source: string; }; }; };
    };
    assert.strictEqual(changed.payload.type, CATALOG_CHANGED);
    assert.strictEqual(changed.payload.change.record.source, "textures/grass.png");
    assert.strictEqual(
      (author.received.at(-1) as { payload: { type: string; }; }).payload.type,
      CATALOG_APPLIED
    );

    const counter = backend.catalog.snapshot().assets
      .find((record) => record.source === "a.counter")!;
    const room = assetRoomName("counter", counter.id);
    await server.handleMessage("B", { room, kind: "join" });

    await server.handleMessage("A", {
      room: CATALOG_ROOM,
      kind: "message",
      payload: {
        type: CATALOG_DELETE,
        assetId: counter.id
      }
    });
    await backend.flush();

    assert.deepEqual(peer.received.at(-1), {
      room,
      kind: "message",
      payload: { type: "deleted" }
    });
    await assert.rejects(fs.access(path.join(workspace.root, "a.counter")));

    await server.close();
  });
});
