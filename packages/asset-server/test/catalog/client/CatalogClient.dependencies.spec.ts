// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CATALOG_CHANGED,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT,
  CatalogClient,
  CatalogUnavailableError,
  type CatalogCommand,
  type CatalogMessage,
  type CatalogRoom
} from "#src/catalog/client/index.ts";

class FakeCatalogRoom implements CatalogRoom {
  readonly sent: CatalogCommand[] = [];
  joined = false;
  left = false;
  #listener: ((message: CatalogMessage) => void) | null = null;

  on(
    _type: string,
    listener: (message: CatalogMessage) => void
  ): void {
    this.#listener = listener;
  }

  off(): void {
    this.#listener = null;
  }

  join(): void {
    this.joined = true;
  }

  leave(): void {
    this.left = true;
  }

  send(
    command: CatalogCommand
  ): void {
    this.sent.push(command);
  }

  receive(
    message: CatalogMessage
  ): void {
    this.#listener?.(message);
  }

  requestId(
    index: number
  ): string {
    return this.sent[index].requestId;
  }
}

function snapshot(
  room: FakeCatalogRoom
): void {
  room.receive({
    type: CATALOG_SNAPSHOT,
    manifest: {
      version: 1,
      assets: [
        {
          id: "a1",
          kind: "pixelart",
          source: "textures/a.pixelart"
        }
      ]
    },
    folders: []
  });
}

describe("CatalogClient — dependencies", () => {
  function reference(
    id: string
  ): { id: string; kind: string; } {
    return {
      id,
      kind: "pixelart"
    };
  }

  function changed(
    room: FakeCatalogRoom,
    assetId: string,
    dependencies?: { id: string; kind: string; }[]
  ): void {
    room.receive({
      type: CATALOG_CHANGED,
      changes: [{
        eventType: "asset.updated",
        assetId,
        record: {
          id: assetId,
          kind: "voxelmap",
          source: `${assetId}.voxelmap.json`
        },
        dependencies
      }]
    });
  }

  test("reads edges from the snapshot", () => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    const emitted: string[] = [];
    client.on("dependencies", (assetId) => emitted.push(assetId));

    room.receive({
      type: CATALOG_SNAPSHOT,
      manifest: { version: 1, assets: [] },
      dependencies: {
        map: [reference("a")],
        a: [reference("b")]
      },
      folders: []
    });

    assert.deepEqual(client.dependencies.listDependencies("map"), [reference("a")]);
    assert.deepEqual(client.dependencies.listDependents("a"), ["map"]);
    assert.deepEqual(client.dependencies.transitiveDependencies("map"), [reference("a"), reference("b")]);
    assert.deepEqual(emitted, ["map", "a"]);
  });

  test("emits only when an asset's edges change", () => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);
    const emitted: string[] = [];
    client.on("dependencies", (assetId) => emitted.push(assetId));

    changed(room, "map", [reference("a")]);
    changed(room, "map", [reference("a")]);
    changed(room, "map", [reference("b")]);
    room.receive({
      type: CATALOG_CHANGED,
      changes: [{
        eventType: "asset.deleted",
        assetId: "map",
        record: null
      }]
    });

    assert.deepEqual(emitted, ["map", "map", "map"]);
    assert.deepEqual(client.dependencies.listDependencies("map"), []);
  });

  test("a new snapshot drops edges it no longer lists", () => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);
    changed(room, "map", [reference("a")]);
    const emitted: string[] = [];
    client.on("dependencies", (assetId) => emitted.push(assetId));

    snapshot(room);

    assert.deepEqual(emitted, ["map"]);
    assert.deepEqual(client.dependencies.listDependents("a"), []);
  });

  test("emits one change per message after the edges are applied", () => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    const seen: { id: string; kind: string; }[][] = [];
    client.on("change", () => {
      seen.push(client.dependencies.transitiveDependencies("map"));
    });

    room.receive({
      type: CATALOG_SNAPSHOT,
      manifest: { version: 1, assets: [] },
      dependencies: {
        map: [reference("a")],
        a: [reference("b")]
      },
      folders: []
    });
    changed(room, "map", [reference("c")]);

    assert.deepEqual(seen, [
      [reference("a"), reference("b")],
      [reference("c")]
    ]);
  });

  test("listDependents lists only the dependents with a record", () => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    room.receive({
      type: CATALOG_SNAPSHOT,
      manifest: { version: 1, assets: [] },
      dependencies: {
        map: [reference("a")]
      },
      folders: []
    });

    assert.deepEqual(client.dependencies.listDependents("a"), ["map"]);
    assert.deepEqual(client.listDependents("a"), []);

    changed(room, "map", [reference("a")]);

    assert.deepEqual(client.listDependents("a"), [
      {
        id: "map",
        kind: "voxelmap",
        source: "map.voxelmap.json"
      }
    ]);
  });
});

describe("CatalogClient.connect", () => {
  function roomSource(
    room: FakeCatalogRoom
  ): { names: string[]; room(name: string): FakeCatalogRoom; } {
    const names: string[] = [];

    return {
      names,
      room(name) {
        names.push(name);

        return room;
      }
    };
  }

  test("opens the catalog room and resolves once the snapshot arrives", async() => {
    const room = new FakeCatalogRoom();
    const source = roomSource(room);

    const connecting = CatalogClient.connect(source);
    snapshot(room);
    const client = await connecting;

    assert.deepEqual(source.names, [CATALOG_ROOM]);
    assert.strictEqual(room.joined, true);
    assert.strictEqual(client.record("a1")?.source, "textures/a.pixelart");
  });

  test("rejects and leaves the room when no snapshot arrives in time", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const room = new FakeCatalogRoom();

    const connecting = CatalogClient.connect(roomSource(room), {
      timeoutMs: 100
    });
    t.mock.timers.tick(100);

    await assert.rejects(connecting, CatalogUnavailableError);
    assert.strictEqual(room.left, true);
  });
});
