// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_CREATE,
  CATALOG_DELETE,
  CATALOG_RENAME,
  CATALOG_REJECTED,
  CATALOG_SNAPSHOT,
  CatalogClient,
  CatalogRejectedError,
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
          path: "textures/a.pixelart"
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
      content: undefined,
      from: undefined
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
});
