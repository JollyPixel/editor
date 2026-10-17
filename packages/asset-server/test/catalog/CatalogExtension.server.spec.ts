// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { Server } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  CatalogExtension,
  CatalogProjection,
  encodeContent,
  CATALOG_CREATE,
  CATALOG_DELETE,
  CATALOG_RENAME,
  CATALOG_ROOM
} from "#src/index.ts";
import { catalogBackend, syncHarness } from "../helpers/backend.ts";
import { bytes } from "../helpers/bytes.ts";
import { recordingClient } from "../helpers/rooms.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("CatalogExtension — server", () => {
  test("a role granted create but not delete is denied the delete", async() => {
    await using sync = await syncHarness();
    const projection = new CatalogProjection({
      projector: sync.projector
    });
    projection.load();
    projection.start();
    const created = (await sync.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();

    const server = new Server({
      rights: {
        author: {
          [`${CATALOG_ROOM}.${CATALOG_DELETE}`]: "read",
          "*": "write"
        }
      }
    });
    server.register(new CatalogExtension({
      backend: catalogBackend(sync, projection)
    }));
    const author = recordingClient("A");
    const connectionA = server.connect(author, { subject: "A", role: "author" });
    await connectionA.receive({ room: CATALOG_ROOM, kind: "join" });

    await connectionA.receive({
      room: CATALOG_ROOM,
      kind: "message",
      payload: {
        type: CATALOG_DELETE,
        requestId: "r106",
        assetIds: [created.assetId]
      }
    });
    const denied = author.received.at(-1);
    await connectionA.receive({
      room: CATALOG_ROOM,
      kind: "message",
      payload: {
        type: CATALOG_CREATE,
        requestId: "r107",
        path: "b.png",
        content: encodeContent(bytes("two"))
      }
    });

    assert.deepEqual(denied, {
      room: CATALOG_ROOM,
      kind: "denied",
      event: CATALOG_DELETE,
      reason: `role "author" cannot write "${CATALOG_DELETE}"`
    });
    assert.notStrictEqual(sync.identity.byId(created.assetId), undefined);
    assert.notStrictEqual(sync.identity.byPath("b.png"), undefined);

    await server.close();
    projection.close();
  });

  test("a malformed command gets an error envelope", async() => {
    await using sync = await syncHarness();
    const projection = new CatalogProjection({
      projector: sync.projector
    });
    projection.load();

    const server = new Server();
    server.register(new CatalogExtension({
      backend: catalogBackend(sync, projection)
    }));
    const author = recordingClient("A");
    const connectionA = server.connect(author, { subject: "A", role: "default" });
    await connectionA.receive({ room: CATALOG_ROOM, kind: "join" });

    await connectionA.receive({
      room: CATALOG_ROOM,
      kind: "message",
      payload: {
        type: CATALOG_RENAME,
        assetId: "a1"
      }
    });

    assert.strictEqual(
      (author.received.at(-1) as { kind: string; }).kind,
      "error"
    );

    await server.close();
    projection.close();
  });
});
