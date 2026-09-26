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
import { AssetRoom } from "@jolly-pixel/asset";
import {
  createAssetBackend,
  foldAssetEvent
} from "@jolly-pixel/asset-server";
import {
  decodeVoxelDocument,
  encodeVoxelDocument
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  createTilesetDocument,
  encodeTilesetDocument,
  TILESET_KIND,
  tilesetAsset,
  tilesetAssetKind,
  VOXEL_MAP_COMMAND,
  VOXEL_MAP_KIND,
  voxelMapAssetKind,
  VoxelMapState
} from "../../src/index.ts";
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
  const handler = voxelMapAssetKind({ chunkSize: kChunkSize });
  const state = handler.create(assetId);
  for (const event of eventStore.reader.list(assetId)) {
    foldAssetEvent(handler, state, event);
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
          voxelMapAssetKind({
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

      const server = new Server();
      backend.attach(server);
      const room = new AssetRoom(VOXEL_MAP_KIND, record.id).toString();

      server.handleConnect(client("A"), { subject: "A", role: "default" });
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
        handlers: [voxelMapAssetKind({ chunkSize: kChunkSize })],
        watch: false
      });
      const record = backend.catalog.snapshot().assets[0];

      const server = new Server();
      backend.attach(server);
      const room = new AssetRoom(VOXEL_MAP_KIND, record.id).toString();

      server.handleConnect(client("A"), { subject: "A", role: "default" });
      server.handleConnect(client("B"), { subject: "B", role: "default" });
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

  test("a map linking a tileset asset records the dependency edge", async() => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "jolly-voxel-map-asset-")
    );

    try {
      using eventStore = EventStore.persistence.memory();
      await fs.mkdir(path.join(root, "textures"), { recursive: true });
      await fs.writeFile(
        path.join(root, "textures/stone.tileset.json"),
        encodeTilesetDocument(createTilesetDocument({ tileSize: 8 }))
      );

      await using backend = await createAssetBackend({
        source: new FilesystemAssetSource(root),
        eventStore,
        handlers: [
          tilesetAssetKind(),
          voxelMapAssetKind({ chunkSize: kChunkSize })
        ],
        watch: false
      });
      const tileset = backend.catalog.snapshot().assets
        .find((entry) => entry.kind === TILESET_KIND)!;

      const linked = new VoxelMapState(kChunkSize);
      linked.tilesets.add({
        id: "stone",
        asset: tilesetAsset(tileset.id)
      });
      const mapId = "map-linked";
      (await backend.writer.create({
        path: "maps/linked.voxelmap.json",
        kind: VOXEL_MAP_KIND,
        data: encodeVoxelDocument(linked.toJSON()),
        assetId: mapId,
        actor: {
          type: "user",
          id: "u1"
        }
      })).unwrap();

      assert.deepEqual(
        backend.catalog.dependencies.dependenciesOf(mapId),
        [tilesetAsset(tileset.id)]
      );
      assert.deepEqual(
        backend.catalog.dependencies.dependentsOf(tileset.id),
        [mapId]
      );
    }
    finally {
      await fs.rm(root, {
        recursive: true,
        force: true
      });
    }
  });
});
