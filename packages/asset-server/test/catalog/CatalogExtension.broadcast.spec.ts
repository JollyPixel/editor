// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  CatalogExtension,
  CatalogProjection,
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_CREATE_FOLDER,
  CATALOG_DELETE,
  CATALOG_DELETE_FOLDER,
  CATALOG_EXPORT,
  CATALOG_FOLDERS,
  CATALOG_IMPORT,
  CATALOG_MOVE_FOLDER,
  CATALOG_PLAN,
  CATALOG_REJECTED,
  CATALOG_RENAME,
  CATALOG_REPLACE,
  CATALOG_RESTORE,
  CATALOG_SNAPSHOT,
  CATALOG_TAG,
  CATALOG_TAGS,
  CATALOG_TAGS_CHANGED,
  CATALOG_UNTAG
} from "#src/index.ts";
import { catalogBackend, syncHarness } from "../helpers/backend.ts";
import { bytes } from "../helpers/bytes.ts";
import {
  recordingClient,
  recordingRoom,
  roomPeer
} from "../helpers/rooms.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("CatalogExtension — broadcast", () => {
  test("one broadcast per subsequent catalog event", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    projection.load();
    projection.start();

    const extension = new CatalogExtension({
      backend: catalogBackend(harness, projection)
    });
    const room = recordingRoom();
    extension.onClientConnect(recordingClient("A"), roomPeer("A"), room.context);

    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });

    assert.strictEqual(room.broadcasts.length, 1);
    assert.deepEqual(
      (room.broadcasts[0] as { type: string; }).type,
      CATALOG_CHANGED
    );
    extension.dispose();
    projection.close();
  });

  test("stops broadcasting once the last client left", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    projection.start();

    const extension = new CatalogExtension({
      backend: catalogBackend(harness, projection)
    });
    const room = recordingRoom();
    extension.onClientConnect(recordingClient("A"), roomPeer("A"), room.context);
    extension.onClientDisconnect("A");

    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });

    assert.deepEqual(room.broadcasts, []);
    extension.dispose();
    projection.close();
  });

  test("dispose unsubscribes from the projection", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    projection.start();

    const extension = new CatalogExtension({
      backend: catalogBackend(harness, projection)
    });
    const room = recordingRoom();
    extension.onClientConnect(recordingClient("A"), roomPeer("A"), room.context);
    extension.dispose();

    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });

    assert.deepEqual(room.broadcasts, []);
    projection.close();
  });

  test("names its wire events for the rights table", async() => {
    await using harness = await syncHarness();
    const extension = new CatalogExtension({
      backend: catalogBackend(harness, new CatalogProjection({
        projector: harness.projector
      }))
    });

    assert.deepEqual(
      extension.protocols.inbound!.events,
      [
        CATALOG_CREATE,
        CATALOG_RENAME,
        CATALOG_DELETE,
        CATALOG_CREATE_FOLDER,
        CATALOG_MOVE_FOLDER,
        CATALOG_DELETE_FOLDER,
        CATALOG_EXPORT,
        CATALOG_PLAN,
        CATALOG_IMPORT,
        CATALOG_TAGS,
        CATALOG_TAG,
        CATALOG_UNTAG,
        CATALOG_RESTORE,
        CATALOG_REPLACE
      ]
    );
    assert.deepEqual(
      extension.protocols.outbound!.events,
      [
        CATALOG_SNAPSHOT,
        CATALOG_CHANGED,
        CATALOG_FOLDERS,
        CATALOG_TAGS_CHANGED,
        CATALOG_APPLIED,
        CATALOG_REJECTED
      ]
    );
    extension.dispose();
  });
});
