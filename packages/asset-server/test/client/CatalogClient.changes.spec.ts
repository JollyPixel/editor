// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import {
  CATALOG_CHANGED,
  CATALOG_SNAPSHOT,
  CatalogClient
} from "#src/client/index.ts";
import { FakeCatalogRoom } from "../helpers/catalogRoom.ts";

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
            path: "textures/b.pixelart"
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
