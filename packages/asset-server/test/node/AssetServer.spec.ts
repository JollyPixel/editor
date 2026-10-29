// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import {
  Extension,
  type RoomContext
} from "@jolly-pixel/network";
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { STATE_GITIGNORE_PATH } from "#src/index.ts";
import { AssetServer } from "#src/node.ts";
import { tempDirectory } from "../helpers/tempDirectory.ts";
import { counterHandler, liveCounterHandler } from "../helpers/kinds.ts";
import { counterProtocols } from "../helpers/protocols.ts";
import { bytes } from "../helpers/bytes.ts";
import { recordingClient } from "../helpers/rooms.ts";

class StaticExtension extends Extension {
  readonly id: string;
  readonly name = "static";
  readonly protocols = counterProtocols;

  constructor(
    id: string
  ) {
    super();
    this.id = id;
  }

  override onMessage(
    _clientId: string,
    _payload: unknown,
    _context: RoomContext
  ): void {
    return void 0;
  }
}

describe("AssetServer", () => {
  test("seeds, catalogs and serves the project over one network server", async() => {
    await using temporary = await tempDirectory();
    await using eventStore = EventStore.persistence.memory();

    await using assetServer = await AssetServer.open({
      root: temporary.root,
      eventStore,
      handlers: [liveCounterHandler()],
      seed: {
        "counter.counter": () => bytes("0")
      },
      backend: {
        reconcile: {
          watch: false
        }
      }
    });

    assert.strictEqual(
      await fs.readFile(
        path.join(temporary.root, "counter.counter"),
        "utf8"
      ),
      "0"
    );
    assert.strictEqual(assetServer.backend.catalog.size, 1);

    const record = assetServer.backend.catalog.snapshot().assets[0];
    assert.strictEqual(record.kind, "counter");

    const connectionA = assetServer.network.connect(recordingClient("A"), { subject: "A", role: "default" });
    const joined = await connectionA.receive({
      room: new AssetRoom(record.kind, record.id).toString(),
      kind: "join"
    });
    assert.notStrictEqual(joined, null);
  });

  test("seeds a root that does not exist yet", async() => {
    await using temporary = await tempDirectory();
    await using eventStore = EventStore.persistence.memory();
    const root = path.join(temporary.root, "assets");

    await using assetServer = await AssetServer.open({
      root,
      eventStore,
      handlers: [liveCounterHandler()],
      seed: {
        "counter.counter": () => bytes("0")
      },
      backend: {
        reconcile: {
          watch: false
        }
      }
    });

    assert.strictEqual(
      await fs.readFile(
        path.join(root, "counter.counter"),
        "utf8"
      ),
      "0"
    );
    assert.strictEqual(assetServer.backend.catalog.size, 1);
  });

  test("keeps an existing document over its seed", async() => {
    await using temporary = await tempDirectory();
    await using eventStore = EventStore.persistence.memory();

    await fs.writeFile(
      path.join(temporary.root, "counter.counter"),
      bytes("7")
    );

    await using assetServer = await AssetServer.open({
      root: temporary.root,
      eventStore,
      handlers: [counterHandler()],
      seed: {
        "counter.counter": () => bytes("0")
      },
      backend: {
        reconcile: {
          watch: false
        }
      }
    });

    assert.strictEqual(
      await fs.readFile(
        path.join(temporary.root, "counter.counter"),
        "utf8"
      ),
      "7"
    );
    assert.strictEqual(assetServer.backend.catalog.size, 1);
  });

  test("keeps an in-memory server out of its root", async() => {
    await using temporary = await tempDirectory();
    const root = path.join(temporary.root, "assets");

    await using assetServer = await AssetServer.open({
      root,
      inMemory: true,
      handlers: [liveCounterHandler()],
      seed: {
        "counter.counter": () => bytes("0")
      },
      backend: {
        reconcile: {
          watch: false
        }
      }
    });

    assert.strictEqual(assetServer.backend.catalog.size, 1);
    await assert.rejects(
      fs.access(root),
      { code: "ENOENT" }
    );
  });

  test("uses the source it is given", async() => {
    await using eventStore = EventStore.persistence.memory();
    const source = new MemoryAssetSource();

    await using assetServer = await AssetServer.open({
      root: "unused-when-a-source-is-given",
      source,
      eventStore,
      seed: {
        "a.png": () => bytes("bytes")
      },
      backend: {
        reconcile: {
          watch: false
        }
      }
    });

    assert.strictEqual(assetServer.source, source);
    assert.deepStrictEqual(
      await source.list(),
      ["a.png"]
    );
    assert.match(
      new TextDecoder().decode(await source.read(STATE_GITIGNORE_PATH)),
      /events\.db/
    );
  });

  test("registers the extensions it is given on the server it built", async() => {
    await using eventStore = EventStore.persistence.memory();
    const extension = new StaticExtension("static-room");

    await using assetServer = await AssetServer.open({
      root: "unused",
      source: new MemoryAssetSource(),
      eventStore,
      extensions: [extension],
      backend: {
        reconcile: {
          watch: false
        }
      }
    });

    const connectionA = assetServer.network.connect(recordingClient("A"), { subject: "A", role: "default" });
    const joined = await connectionA.receive({
      room: "static-room",
      kind: "join"
    });

    assert.notStrictEqual(joined, null);
  });

  test("leaves an event store it does not own open", async() => {
    await using eventStore = EventStore.persistence.memory();

    const assetServer = await AssetServer.open({
      root: "unused",
      source: new MemoryAssetSource(),
      eventStore,
      backend: {
        reconcile: {
          watch: false
        }
      }
    });
    await assetServer.close();

    const appended = await eventStore.writer.append({
      assetType: "counter",
      assetId: "a1",
      eventType: "counter.incremented",
      eventData: {},
      actor: { type: "user", id: "tester" }
    });

    assert.ok(appended.ok);
    assert.strictEqual((await eventStore.reader.listAll()).length, 1);
  });
});
