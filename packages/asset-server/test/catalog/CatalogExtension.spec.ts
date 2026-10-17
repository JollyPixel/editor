// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  CatalogExtension,
  CatalogProjection,
  CATALOG_SNAPSHOT
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

describe("CatalogExtension — join", () => {
  test("sends the snapshot to the joining client", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    projection.load();

    const extension = new CatalogExtension({
      backend: catalogBackend(harness, projection)
    });
    const room = recordingRoom();
    extension.onClientConnect(recordingClient("A"), roomPeer("A"), room.context);

    assert.strictEqual(room.direct.length, 1);
    assert.deepEqual(room.direct[0], {
      clientId: "A",
      payload: {
        type: CATALOG_SNAPSHOT,
        manifest: projection.snapshot(),
        dependencies: {
          [projection.snapshot().assets[0].id]: []
        },
        folders: []
      }
    });
    extension.dispose();
  });

  test("every joiner gets its own snapshot", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    projection.load();

    const extension = new CatalogExtension({
      backend: catalogBackend(harness, projection)
    });
    const room = recordingRoom();
    extension.onClientConnect(recordingClient("A"), roomPeer("A"), room.context);
    extension.onClientConnect(recordingClient("B"), roomPeer("B"), room.context);

    assert.deepEqual(
      room.direct.map((entry) => entry.clientId),
      ["A", "B"]
    );
    extension.dispose();
  });

  test("a later joiner sees assets and folders changed since an earlier join", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    projection.load();
    projection.start();

    const backend = catalogBackend(harness, projection);
    const extension = new CatalogExtension({ backend });
    const room = recordingRoom();
    extension.onClientConnect(recordingClient("A"), roomPeer("A"), room.context);
    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    extension.onClientConnect(recordingClient("B"), roomPeer("B"), room.context);
    await backend.folders.create("textures");
    extension.onClientConnect(recordingClient("C"), roomPeer("C"), room.context);

    const snapshots = room.direct
      .filter((entry) => entry.clientId !== "A")
      .map((entry) => entry.payload);
    const manifest = projection.snapshot();
    const dependencies = { [manifest.assets[0].id]: [] };
    assert.deepEqual(snapshots, [
      {
        type: CATALOG_SNAPSHOT,
        manifest,
        dependencies,
        folders: []
      },
      {
        type: CATALOG_SNAPSHOT,
        manifest,
        dependencies,
        folders: ["textures"]
      }
    ]);
    extension.dispose();
  });
});
