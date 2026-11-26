// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_DELETE,
  CATALOG_RENAME,
  CATALOG_SNAPSHOT,
  CatalogClient,
  CatalogRejectedError
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
