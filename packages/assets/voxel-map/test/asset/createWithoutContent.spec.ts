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
  decodeTilesetDocument,
  TILESET_KIND,
  tilesetAsset,
  tilesetAssetKind,
  VOXEL_MAP_KIND,
  voxelMapAssetKind,
  VoxelMapState
} from "../../src/index.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};
const kTilesetSize = {
  x: 64,
  y: 32
};

describe("voxel map created without content", () => {
  test("comes with a same-named tileset it links", async() => {
    using eventStore = EventStore.persistence.memory();
    const source = new MemoryAssetSource();
    await using backend = await createAssetBackend({
      source,
      eventStore,
      handlers: [
        voxelMapAssetKind(),
        tilesetAssetKind({ defaultSize: kTilesetSize })
      ],
      watch: false
    });

    const map = (await backend.writer.create({
      path: "maps/new.voxelmap.json",
      kind: VOXEL_MAP_KIND,
      actor: kActor
    })).unwrap();
    await backend.flush();

    const tileset = backend.catalog.snapshot().assets
      .find((record) => record.source === "maps/new.tileset.json");
    assert.strictEqual(tileset?.kind, TILESET_KIND);
    assert.deepEqual(
      backend.catalog.dependencies.dependenciesOf(map.assetId),
      [tilesetAsset(tileset.id)]
    );

    const state = new VoxelMapState(16);
    state.load(decodeVoxelWorld(await source.read("maps/new.voxelmap.json")));
    assert.deepEqual(
      state.tilesets.definitions().map((definition) => definition.asset),
      [tilesetAsset(tileset.id)]
    );

    const document = decodeTilesetDocument(
      await source.read("maps/new.tileset.json")
    );
    assert.deepEqual(document.pixels.size, kTilesetSize);
  });
});
