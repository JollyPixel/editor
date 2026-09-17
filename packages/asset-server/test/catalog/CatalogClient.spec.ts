// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_RENAME,
  CATALOG_REJECTED,
  CATALOG_SNAPSHOT,
  CatalogClient,
  CatalogRejectedError,
  type CatalogCommand,
  type CatalogMessage,
  type CatalogRoom
} from "../../src/catalog/client.ts";

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
    return this.sent[index].requestId ?? "";
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
    }
  });
}

async function flush(): Promise<void> {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
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
      change: {
        eventType: "asset.created",
        assetId: "a2",
        record: {
          id: "a2",
          kind: "pixelart",
          source: "textures/b.pixelart"
        }
      }
    });
    room.receive({
      type: CATALOG_CHANGED,
      change: {
        eventType: "asset.deleted",
        assetId: "a1",
        record: null
      }
    });

    assert.equal(room.joined, true);
    assert.equal(changes, 3);
    assert.deepEqual([...client.records()].map(({ id }) => id), ["a2"]);
    assert.equal(client.record("a2")?.source, "textures/b.pixelart");
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

  test("ignores replies without a known request id", async() => {
    const room = new FakeCatalogRoom();
    const client = new CatalogClient(room);
    snapshot(room);

    const removed = client.remove("a1");
    await flush();
    room.receive({
      type: CATALOG_APPLIED,
      command: CATALOG_RENAME,
      assetId: "a1"
    });
    room.receive({
      type: CATALOG_APPLIED,
      requestId: "unknown",
      command: CATALOG_RENAME,
      assetId: "a1"
    });
    room.receive({
      type: CATALOG_APPLIED,
      requestId: room.requestId(0),
      command: CATALOG_RENAME,
      assetId: "a1"
    });

    await removed;
    assert.equal(room.sent[0].type, "catalog:delete");
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
