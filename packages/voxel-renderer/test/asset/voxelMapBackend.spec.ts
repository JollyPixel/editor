// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { FilesystemAssetSource } from "@jolly-pixel/asset-source";
import { Server, type ClientHandle } from "@jolly-pixel/network";
import {
  assetRoomName,
  createAssetBackend
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  VOXEL_MAP_COMMAND,
  VOXEL_MAP_KIND,
  voxelMapAssetHandler,
  VoxelMapState
} from "../../src/asset/index.ts";
import {
  decodeVoxelDocument,
  encodeVoxelDocument
} from "../../src/serialization/index.ts";
import { voxelSetCmd } from "../helpers/networkCommands.ts";

// CONSTANTS
const kChunkSize = 16;
const kDocumentPath = "maps/overworld.voxelmap.json";

function client(
  id: string
): ClientHandle {
  return {
    id,
    send: () => void 0
  };
}

function seededDocument(): Uint8Array {
  const state = new VoxelMapState(kChunkSize);
  state.world.addLayer("Ground");

  return encodeVoxelDocument(state.toJSON());
}

function stateFromFile(
  data: Uint8Array
): VoxelMapState {
  const state = new VoxelMapState(kChunkSize);
  state.load(decodeVoxelDocument(data));

  return state;
}

/**
 * Replays an asset stream into a fresh world.
 */
function replay(
  eventStore: EventStore.EventStore,
  assetId: string
): VoxelMapState {
  const handler = voxelMapAssetHandler({ chunkSize: kChunkSize });
  const state = handler.create(assetId);
  for (const event of eventStore.reader.list(assetId)) {
    handler.apply(state, event);
  }

  return state;
}

describe("voxel-map asset kind over a real back-end", () => {
  test("edits reach the file and a cold replay agrees with live state", async(t) => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "jolly-voxel-map-asset-")
    );

    try {
      using eventStore = EventStore.persistence.memory();
      await fs.mkdir(path.join(root, "maps"), { recursive: true });
      await fs.writeFile(
        path.join(root, kDocumentPath),
        seededDocument()
      );

      t.mock.timers.enable({ apis: ["setTimeout"] });
      await using backend = await createAssetBackend({
        source: new FilesystemAssetSource(root),
        eventStore,
        handlers: [
          voxelMapAssetHandler({
            chunkSize: kChunkSize,
            snapshot: {
              delay: 1_000,
              maxDelay: 5_000
            }
          })
        ],
        watch: false
      });

      const record = backend.catalog.snapshot().assets
        .find((entry) => entry.source === kDocumentPath)!;
      assert.strictEqual(record.kind, VOXEL_MAP_KIND);

      const server = new Server({ eventStore });
      backend.attach(server);
      const room = assetRoomName(VOXEL_MAP_KIND, record.id);

      server.handleConnect(client("A"));
      await server.handleMessage("A", {
        room,
        kind: "join"
      });
      await server.handleMessage("A", {
        room,
        kind: "message",
        payload: voxelSetCmd({
          x: 2,
          y: 1,
          z: 3,
          blockId: 5
        })
      });

      assert.strictEqual(
        eventStore.reader
          .list(record.id)
          .filter((event) => event.eventType === VOXEL_MAP_COMMAND)
          .length,
        1
      );

      // Commands do not update the source before a snapshot.
      assert.strictEqual(
        stateFromFile(
          await fs.readFile(path.join(root, kDocumentPath))
        ).world.getVoxelAt({ x: 2, y: 1, z: 3 }),
        undefined
      );

      t.mock.timers.tick(1_000);
      await backend.flush(record.id);

      const onDisk = stateFromFile(
        await fs.readFile(path.join(root, kDocumentPath))
      );
      assert.strictEqual(
        onDisk.world.getVoxelAt({ x: 2, y: 1, z: 3 })?.blockId,
        5
      );

      assert.strictEqual(
        replay(eventStore, record.id).world
          .getVoxelAt({ x: 2, y: 1, z: 3 })?.blockId,
        5
      );

      await server.close();
    }
    finally {
      await fs.rm(root, {
        recursive: true,
        force: true
      });
    }
  });

  test("a command losing conflict resolution is never appended", async() => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "jolly-voxel-map-asset-")
    );

    try {
      using eventStore = EventStore.persistence.memory();
      await fs.writeFile(
        path.join(root, "a.voxelmap.json"),
        seededDocument()
      );

      await using backend = await createAssetBackend({
        source: new FilesystemAssetSource(root),
        eventStore,
        handlers: [voxelMapAssetHandler({ chunkSize: kChunkSize })],
        watch: false
      });
      const record = backend.catalog.snapshot().assets[0];

      const server = new Server({ eventStore });
      backend.attach(server);
      const room = assetRoomName(VOXEL_MAP_KIND, record.id);

      server.handleConnect(client("A"));
      server.handleConnect(client("B"));
      await server.handleMessage("A", {
        room,
        kind: "join"
      });
      await server.handleMessage("B", {
        room,
        kind: "join"
      });

      await server.handleMessage("A", {
        room,
        kind: "message",
        payload: voxelSetCmd({
          clientId: "A",
          timestamp: 2_000,
          blockId: 5
        })
      });
      // The older write loses.
      await server.handleMessage("B", {
        room,
        kind: "message",
        payload: voxelSetCmd({
          clientId: "B",
          timestamp: 1_000,
          blockId: 9
        })
      });

      assert.strictEqual(
        eventStore.reader
          .list(record.id)
          .filter((event) => event.eventType === VOXEL_MAP_COMMAND)
          .length,
        1
      );

      await server.close();
    }
    finally {
      await fs.rm(root, {
        recursive: true,
        force: true
      });
    }
  });
});
