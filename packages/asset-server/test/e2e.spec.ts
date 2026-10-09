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
import { FilesystemAssetSource } from "@jolly-pixel/asset-source/node";
import { Server } from "@jolly-pixel/network";
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  createAssetBackend,
  encodeContent,
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_DELETE,
  CATALOG_REJECTED,
  CATALOG_ROOM,
  IDENTITY_SIDECAR_PATH,
  PROJECTION_STATE_PATH,
  STATE_GITIGNORE_PATH
} from "#src/index.ts";
import { tempWorkspace } from "./helpers/tempWorkspace.ts";
import { liveCounterHandler } from "./helpers/kinds.ts";
import { bytes } from "./helpers/bytes.ts";
import { serveCatalog } from "./helpers/catalog.ts";
import { recordingClient } from "./helpers/rooms.ts";

describe("asset-server — end to end", () => {
  test("cold start, live edit, external drift and catalog agree", async(t) => {
    await using workspace = await tempWorkspace();
    using eventStore = EventStore.persistence.memory();

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

    const server = new Server();
    backend.attach(server);
    const room = new AssetRoom("counter", counterRecord.id).toString();

    const connectionA = server.connect(recordingClient("A"), { subject: "A", role: "default" });
    await connectionA.receive({ room, kind: "join" });
    for (let index = 0; index < 3; index++) {
      await connectionA.receive({
        room,
        kind: "message",
        payload: { action: "increment" }
      });
    }

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

    await fs.writeFile(
      path.join(workspace.root, "textures", "grass.png"),
      bytes("grass-edited")
    );
    await fs.rm(path.join(workspace.root, "textures", "grass.png"));
    await fs.writeFile(
      path.join(workspace.root, "textures", "dirt.png"),
      bytes("grass-edited")
    );
    (await backend.reconcile()).unwrap();
    await backend.flush();

    const drifted = backend.catalog.snapshot().assets
      .find((record) => record.kind === "binary")!;
    assert.strictEqual(drifted.source, "textures/dirt.png");
    assert.deepEqual(
      eventStore.reader.listAll({ eventTypePrefix: "asset." }).at(-1)!.actor,
      { type: "system", source: "fs-watcher" }
    );

    await using catalogServer = await serveCatalog(backend.catalog);
    const response = await fetch(
      `${catalogServer.origin}/__jollypixel/catalog`
    );
    assert.strictEqual(response.status, 200);
    assert.deepEqual(await response.json(), JSON.parse(
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
    const server = new Server();
    backend.attach(server);

    const author = recordingClient("A");
    const peer = recordingClient("B");
    const [connectionA, connectionB] = [author, peer].map(
      (handle) => server.connect(handle, { subject: handle.id, role: "default" })
    );
    for (const connection of [connectionA, connectionB]) {
      await connection.receive({ room: CATALOG_ROOM, kind: "join" });
    }

    await connectionA.receive({
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
      payload: { type: string; changes: { record: { source: string; }; }[]; };
    };
    assert.strictEqual(changed.payload.type, CATALOG_CHANGED);
    assert.strictEqual(changed.payload.changes[0].record.source, "textures/grass.png");
    assert.strictEqual(
      (author.received.at(-1) as { payload: { type: string; }; }).payload.type,
      CATALOG_APPLIED
    );

    const counter = backend.catalog.snapshot().assets
      .find((record) => record.source === "a.counter")!;
    const room = new AssetRoom("counter", counter.id).toString();
    await connectionB.receive({ room, kind: "join" });

    await connectionA.receive({
      room: CATALOG_ROOM,
      kind: "message",
      payload: {
        type: CATALOG_DELETE,
        requestId: "r101",
        assetIds: [counter.id]
      }
    });
    await backend.flush();

    assert.deepEqual(
      peer.received.filter((envelope) => (envelope as { room: string; }).room === room).at(-1),
      {
        room,
        kind: "message",
        payload: { type: "deleted" }
      }
    );
    await assert.rejects(fs.access(path.join(workspace.root, "a.counter")));

    await server.close();
  });

  test("catalogMaxContentBytes caps catalog:create payloads", async() => {
    await using workspace = await tempWorkspace();
    using eventStore = EventStore.persistence.memory();

    await using backend = await createAssetBackend({
      source: new FilesystemAssetSource(workspace.root),
      eventStore,
      watch: false,
      catalogMaxContentBytes: 4
    });
    const server = new Server();
    backend.attach(server);

    const author = recordingClient("A");
    const connectionA = server.connect(author, { subject: author.id, role: "default" });
    await connectionA.receive({ room: CATALOG_ROOM, kind: "join" });

    for (const [path, content] of [["small.bin", "1234"], ["large.bin", "12345"]]) {
      await connectionA.receive({
        room: CATALOG_ROOM,
        kind: "message",
        payload: {
          type: CATALOG_CREATE,
          requestId: path,
          path,
          content: encodeContent(bytes(content))
        }
      });
    }
    await backend.flush();

    const replies = author.received
      .map((message) => (message as { payload?: { type: string; requestId?: string; }; }).payload)
      .filter((payload) => payload?.requestId !== undefined);
    assert.deepEqual(
      replies.map((payload) => [payload?.requestId, payload?.type]),
      [
        ["small.bin", CATALOG_APPLIED],
        ["large.bin", CATALOG_REJECTED]
      ]
    );

    await server.close();
  });
});
