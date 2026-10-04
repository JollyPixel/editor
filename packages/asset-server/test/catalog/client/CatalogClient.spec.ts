// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_CREATE_FOLDER,
  CATALOG_DELETE,
  CATALOG_DELETE_FOLDER,
  CATALOG_FOLDERS,
  CATALOG_MOVE_FOLDER,
  CATALOG_RENAME,
  CATALOG_REJECTED,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT,
  CatalogClient,
  CatalogRejectedError,
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

async function flush(): Promise<void> {
  await setImmediate();
}

describe("CatalogClient", () => {
  test("joins the room and mirrors the snapshot and later changes", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    let changes = 0;
    client.on("change", () => changes++);

    snapshot(room);
    await client.ready;
    room.receive({
      type: CATALOG_CHANGED,
      changes: [{
        eventType: "asset.created",
        assetId: "a2",
        record: {
          id: "a2",
          kind: "pixelart",
          source: "textures/b.pixelart"
        }
      }]
    });
    room.receive({
      type: CATALOG_CHANGED,
      changes: [{
        eventType: "asset.deleted",
        assetId: "a1",
        record: null
      }]
    });

    assert.equal(room.joined, true);
    assert.equal(changes, 3);
    assert.deepEqual([...client.records()].map(({ id }) => id), ["a2"]);
    assert.equal(client.record("a2")?.source, "textures/b.pixelart");
  });

  test("toSnapshot describes its current state as a catalog:snapshot", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);

    snapshot(room);
    room.receive({
      type: CATALOG_FOLDERS,
      folders: ["textures"]
    });
    await client.ready;

    assert.deepEqual(client.toSnapshot(), {
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
      dependencies: {},
      folders: ["textures"]
    });
  });

  test("waits for the snapshot before sending a request", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);

    void client.rename("a1", "textures/z.pixelart");
    await flush();
    assert.equal(room.sent.length, 0);

    snapshot(room);
    await flush();
    assert.equal(room.sent.length, 1);
  });

  test("resolves a create with the applied asset id", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);

    const created = client.create(
      "textures/c.pixelart",
      new Uint8Array([1, 2]),
      { kind: "pixelart", onConflict: "suffix" }
    );
    await flush();
    const [command] = room.sent;
    room.receive({
      type: CATALOG_APPLIED,
      requestId: room.requestId(0),
      command: CATALOG_CREATE,
      assetId: "a3"
    });

    assert.equal(await created, "a3");
    assert.deepEqual(command, {
      type: CATALOG_CREATE,
      requestId: room.requestId(0),
      path: "textures/c.pixelart",
      kind: "pixelart",
      onConflict: "suffix",
      content: {
        type: "inline",
        encoding: "base64",
        data: btoa(String.fromCharCode(1, 2))
      }
    });
  });

  test("mirrors the folders of the snapshot and later folder lists", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    let changes = 0;
    client.on("change", () => changes++);

    room.receive({
      type: CATALOG_SNAPSHOT,
      manifest: {
        version: 1,
        assets: []
      },
      folders: ["maps"]
    });
    await client.ready;
    const atSnapshot = [...client.folders()];
    room.receive({
      type: CATALOG_FOLDERS,
      folders: ["maps", "maps/draft"]
    });

    assert.deepEqual(atSnapshot, ["maps"]);
    assert.deepEqual([...client.folders()], ["maps", "maps/draft"]);
    assert.strictEqual(changes, 2);
  });

  test("sends folder commands and resolves with the folder path", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);

    const created = client.createFolder("maps/draft");
    await flush();
    room.receive({
      type: CATALOG_APPLIED,
      requestId: room.requestId(0),
      command: CATALOG_CREATE_FOLDER,
      path: "maps/draft"
    });
    const moved = client.moveFolder("maps", "levels");
    await flush();
    room.receive({
      type: CATALOG_APPLIED,
      requestId: room.requestId(1),
      command: CATALOG_MOVE_FOLDER,
      path: "levels"
    });
    const removed = client.removeFolder("levels");
    await flush();
    room.receive({
      type: CATALOG_APPLIED,
      requestId: room.requestId(2),
      command: CATALOG_DELETE_FOLDER,
      path: "levels"
    });

    assert.strictEqual(await created, "maps/draft");
    assert.strictEqual(await moved, "levels");
    await removed;
    assert.deepEqual(room.sent, [
      {
        type: CATALOG_CREATE_FOLDER,
        requestId: room.requestId(0),
        path: "maps/draft"
      },
      {
        type: CATALOG_MOVE_FOLDER,
        requestId: room.requestId(1),
        from: "maps",
        to: "levels"
      },
      {
        type: CATALOG_DELETE_FOLDER,
        requestId: room.requestId(2),
        path: "levels"
      }
    ]);
  });

  test("sends a create without content for a null content", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);

    void client.create(
      "maps/new.voxelmap.json",
      null,
      { kind: "voxelmap" }
    );
    await flush();

    assert.deepEqual(room.sent[0], {
      type: CATALOG_CREATE,
      requestId: room.requestId(0),
      path: "maps/new.voxelmap.json",
      kind: "voxelmap",
      onConflict: undefined,
      content: undefined
    });
  });

  test("rejects a request the server refuses", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);

    const renamed = client.rename("a1", "textures/z.pixelart");
    await flush();
    room.receive({
      type: CATALOG_REJECTED,
      requestId: room.requestId(0),
      command: CATALOG_RENAME,
      reason: "path is already used"
    });

    await assert.rejects(renamed, (error) => {
      assert.ok(error instanceof CatalogRejectedError);
      assert.equal(error.message, "path is already used");
      assert.equal(error.command, CATALOG_RENAME);

      return true;
    });
  });

  test("rejects a single rename or remove the server did not apply", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);

    const renamed = client.rename("a1", "textures/z.pixelart");
    const removed = client.remove("a2");
    await flush();
    room.receive({
      type: CATALOG_APPLIED,
      requestId: room.requestId(0),
      command: CATALOG_RENAME,
      applied: 0,
      failure: "path is already used"
    });
    room.receive({
      type: CATALOG_APPLIED,
      requestId: room.requestId(1),
      command: CATALOG_DELETE,
      applied: 0,
      failure: "asset has dependents"
    });

    await assert.rejects(renamed, (error) => {
      assert.ok(error instanceof CatalogRejectedError);
      assert.equal(error.message, "path is already used");
      assert.equal(error.command, CATALOG_RENAME);

      return true;
    });
    await assert.rejects(removed, (error) => {
      assert.ok(error instanceof CatalogRejectedError);
      assert.equal(error.command, CATALOG_DELETE);

      return true;
    });
  });

  test("ignores replies with an unknown request id", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);

    const removed = client.remove("a1");
    await flush();
    room.receive({
      type: CATALOG_APPLIED,
      requestId: "unknown",
      command: CATALOG_RENAME,
      applied: 1
    });
    room.receive({
      type: CATALOG_APPLIED,
      requestId: room.requestId(0),
      command: CATALOG_DELETE,
      applied: 1
    });

    await removed;
    assert.equal(room.sent[0].type, "catalog:delete");
  });

  test("sends the force flag only when the caller asks for it", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);

    void client.remove("a1");
    void client.remove("a1", { force: true });
    await flush();

    assert.deepEqual(room.sent, [
      {
        type: CATALOG_DELETE,
        requestId: room.requestId(0),
        assetIds: ["a1"],
        force: undefined
      },
      {
        type: CATALOG_DELETE,
        requestId: room.requestId(1),
        assetIds: ["a1"],
        force: true
      }
    ]);
  });

  test("renames and removes many assets with one command each", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);

    const renamed = client.renameMany([
      { assetId: "a1", to: "x.pixelart" },
      { assetId: "a2", to: "y.pixelart" }
    ]);
    const removed = client.removeMany(["a1", "a2"], { force: true });
    await flush();
    room.receive({
      type: CATALOG_APPLIED,
      requestId: room.requestId(0),
      command: CATALOG_RENAME,
      applied: 2
    });
    room.receive({
      type: CATALOG_APPLIED,
      requestId: room.requestId(1),
      command: CATALOG_DELETE,
      applied: 1,
      failure: "asset has dependents"
    });

    assert.deepEqual(await renamed, { applied: 2 });
    assert.deepEqual(await removed, {
      applied: 1,
      failure: "asset has dependents"
    });
    assert.deepEqual(room.sent, [
      {
        type: CATALOG_RENAME,
        requestId: room.requestId(0),
        renames: [
          { assetId: "a1", to: "x.pixelart" },
          { assetId: "a2", to: "y.pixelart" }
        ]
      },
      {
        type: CATALOG_DELETE,
        requestId: room.requestId(1),
        assetIds: ["a1", "a2"],
        force: true
      }
    ]);
  });

  test("sends nothing for an empty list", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);

    assert.deepEqual(await client.renameMany([]), { applied: 0 });
    assert.deepEqual(await client.removeMany([]), { applied: 0 });
    assert.deepEqual(room.sent, []);
  });

  test("applies a list of changes before one change event", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);
    const seen: string[][] = [];
    client.on("change", () => seen.push([...client.records()].map(({ id }) => id)));

    room.receive({
      type: CATALOG_CHANGED,
      changes: [
        {
          eventType: "asset.created",
          assetId: "a2",
          record: {
            id: "a2",
            kind: "pixelart",
            source: "textures/b.pixelart"
          }
        },
        {
          eventType: "asset.deleted",
          assetId: "a1",
          record: null
        }
      ]
    });

    assert.deepEqual(seen, [["a2"]]);
  });

  test("rejects pending requests and leaves the room on dispose", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);

    const renamed = client.rename("a1", "textures/z.pixelart");
    await flush();
    client.dispose();

    await assert.rejects(renamed, /disposed/);
    assert.equal(room.left, true);
  });
});

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

    assert.deepEqual(client.dependencies.dependenciesOf("map"), [reference("a")]);
    assert.deepEqual(client.dependencies.dependentsOf("a"), ["map"]);
    assert.deepEqual(client.dependencies.closureOf("map"), [reference("a"), reference("b")]);
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
    assert.deepEqual(client.dependencies.dependenciesOf("map"), []);
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
    assert.deepEqual(client.dependencies.dependentsOf("a"), []);
  });

  test("emits one change per message after the edges are applied", () => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    const seen: { id: string; kind: string; }[][] = [];
    client.on("change", () => {
      seen.push(client.dependencies.closureOf("map"));
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

  test("dependentsOf lists only the dependents with a record", () => {
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

    assert.deepEqual(client.dependencies.dependentsOf("a"), ["map"]);
    assert.deepEqual(client.dependentsOf("a"), []);

    changed(room, "map", [reference("a")]);

    assert.deepEqual(client.dependentsOf("a"), [
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

describe("CatalogClient — replies", () => {
  test("rejects a reply for another command type", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);

    const renamed = client.rename("a1", "textures/b.pixelart");
    await flush();
    room.receive({
      type: CATALOG_APPLIED,
      requestId: room.requestId(0),
      command: CATALOG_DELETE,
      applied: 1
    });

    await assert.rejects(renamed, (error: unknown) => {
      assert.ok(error instanceof CatalogRejectedError);
      assert.strictEqual(error.command, CATALOG_RENAME);

      return true;
    });
  });
});
