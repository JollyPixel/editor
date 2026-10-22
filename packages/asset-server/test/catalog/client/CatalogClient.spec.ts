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
  CATALOG_DELETE_FOLDER,
  CATALOG_FOLDERS,
  CATALOG_MOVE_FOLDER,
  CATALOG_SNAPSHOT,
  CatalogClient,
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
          path: "textures/b.pixelart"
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
    assert.equal(client.record("a2")?.path, "textures/b.pixelart");
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
            path: "textures/a.pixelart"
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
      { kind: "pixelart", onConflict: "suffix", from: ".png" }
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
      },
      from: ".png"
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
});
