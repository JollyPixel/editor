// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import { createAssetBackend } from "@jolly-pixel/asset-server";
import { decodeVoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  decodeBlocksetDocument,
  BLOCKSET_KIND,
  blocksetAsset,
  blocksetAssetKind,
  VOXEL_MAP_KIND,
  voxelMapAssetKind,
  VoxelMapState
} from "../../src/index.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};
const kBlocksetSize = {
  x: 64,
  y: 32
};

describe("voxel map created without content", () => {
  test("comes with a same-named blockset it links", async() => {
    using eventStore = EventStore.persistence.memory();
    const source = new MemoryAssetSource();
    await using backend = await createAssetBackend({
      source,
      eventStore,
      handlers: [
        voxelMapAssetKind(),
        blocksetAssetKind({ defaultSize: kBlocksetSize })
      ],
      watch: false
    });

    const map = (await backend.writer.create({
      path: "maps/new.voxelmap.json",
      kind: VOXEL_MAP_KIND,
      actor: kActor
    })).unwrap();
    await backend.flush();

    const blockset = backend.catalog.snapshot().assets
      .find((record) => record.source === "maps/new.blockset.json");
    assert.strictEqual(blockset?.kind, BLOCKSET_KIND);
    assert.deepEqual(
      backend.catalog.dependencies.dependenciesOf(map.assetId),
      [blocksetAsset(blockset.id)]
    );

    const state = new VoxelMapState(16);
    state.load(decodeVoxelWorld(await source.read("maps/new.voxelmap.json")));
    assert.deepEqual(
      state.blocksets.definitions().map((definition) => definition.asset),
      [blocksetAsset(blockset.id)]
    );

    const document = decodeBlocksetDocument(
      await source.read("maps/new.blockset.json")
    );
    assert.deepEqual(document.pixels.size, kBlocksetSize);
  });
});
