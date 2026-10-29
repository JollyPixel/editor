// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { FilesystemAssetSource } from "@jolly-pixel/asset-source/node";
import { createAssetBackend } from "@jolly-pixel/asset-server";
import { encodeVoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  createBlocksetFile,
  encodeBlocksetFile,
  BLOCKSET_KIND,
  blocksetAsset,
  blocksetAssetKind,
  VOXEL_MAP_KIND,
  voxelMapAssetKind,
  VoxelMapState
} from "../../src/index.ts";

// CONSTANTS
const kChunkSize = 16;

describe("voxel-map asset kind over a real back-end", () => {
  test("a map linking a blockset asset records the dependency edge", async() => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "jolly-voxel-map-asset-")
    );

    try {
      await using eventStore = EventStore.persistence.memory();
      await fs.mkdir(path.join(root, "textures"), { recursive: true });
      await fs.writeFile(
        path.join(root, "textures/stone.blockset.json"),
        encodeBlocksetFile(createBlocksetFile({ tileSize: 8 }))
      );

      await using backend = await createAssetBackend({
        source: new FilesystemAssetSource(root),
        eventStore,
        handlers: [
          blocksetAssetKind(),
          voxelMapAssetKind({ chunkSize: kChunkSize })
        ],
        reconcile: {
          watch: false
        }
      });
      const blockset = backend.catalog.snapshot().assets
        .find((entry) => entry.kind === BLOCKSET_KIND)!;

      const linked = new VoxelMapState(kChunkSize);
      linked.blocksets.add({
        id: "stone",
        asset: blocksetAsset(blockset.id)
      });
      const mapId = "map-linked";
      (await backend.writer.create({
        path: "maps/linked.voxelmap.json",
        kind: VOXEL_MAP_KIND,
        data: encodeVoxelWorld(linked.toJSON()),
        assetId: mapId,
        actor: {
          type: "user",
          id: "u1"
        }
      })).unwrap();

      assert.deepEqual(
        backend.catalog.dependencies.listDependencies(mapId),
        [blocksetAsset(blockset.id)]
      );
      assert.deepEqual(
        backend.catalog.dependencies.listDependents(blockset.id),
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
