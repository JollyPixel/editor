// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_PREVIEW,
  CATALOG_READ,
  CATALOG_RENAME,
  CATALOG_REPLACE,
  CATALOG_SNAPSHOT,
  CATALOG_TAG,
  CatalogClient,
  CatalogRejectedError
} from "#src/client/index.ts";
import { FakeCatalogRoom } from "../helpers/catalogRoom.ts";

function connected(): {
  room: FakeCatalogRoom;
  client: CatalogClient;
} {
  const room = new FakeCatalogRoom();
  const client = new CatalogClient(room);
  room.receive({
    type: CATALOG_SNAPSHOT,
    manifest: {
      version: 1,
      assets: []
    },
    folders: []
  });

  return {
    room,
    client
  };
}

describe("CatalogClient — rights", () => {
  test("a read right allows only the queries", () => {
    const { room, client } = connected();

    room.admit({
      [CATALOG_READ]: "read",
      [CATALOG_PREVIEW]: "read",
      [CATALOG_REPLACE]: "read",
      [CATALOG_TAG]: "write"
    });

    assert.equal(client.can(CATALOG_READ), true);
    assert.equal(client.can(CATALOG_PREVIEW), true);
    assert.equal(client.can(CATALOG_REPLACE), false);
    assert.equal(client.can(CATALOG_TAG), true);
    assert.equal(client.can(CATALOG_RENAME), false);
  });

  test("emits rights each time the room's rights are set", () => {
    const { room, client } = connected();
    let emitted = 0;
    client.on("rights", () => emitted++);

    room.admit({ [CATALOG_REPLACE]: "write" });
    room.admit({});

    assert.equal(emitted, 2);
  });

  test("a command the member may not send rejects without reaching the room", async() => {
    const { room, client } = connected();
    room.admit({ [CATALOG_RENAME]: "read" });

    await assert.rejects(
      client.rename("a1", "textures/b.pixelart"),
      (error) => {
        assert.ok(error instanceof CatalogRejectedError);
        assert.equal(error.command, CATALOG_RENAME);

        return true;
      }
    );
    assert.deepEqual(room.sent, []);
  });

  test("a refused command rejects only the request it refers to", async() => {
    const { room, client } = connected();

    const first = client.rename("a1", "textures/b.pixelart");
    const second = client.rename("a2", "textures/c.pixelart");
    await setImmediate();
    room.deny(CATALOG_RENAME, "another-client-request");
    room.deny(CATALOG_RENAME, room.requestId(1));
    room.receive({
      type: CATALOG_APPLIED,
      requestId: room.requestId(0),
      command: CATALOG_RENAME,
      applied: 1
    });

    await first;
    await assert.rejects(second, (error) => {
      assert.ok(error instanceof CatalogRejectedError);
      assert.equal(error.command, CATALOG_RENAME);
      assert.equal(error.message, "role \"viewer\" cannot write \"catalog:rename\"");

      return true;
    });
  });
});
