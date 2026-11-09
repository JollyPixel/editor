// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry,
  AssetRecord,
  AssetReference
} from "@jolly-pixel/asset";
import { createBlocksetFile } from "@jolly-pixel/asset.voxel-map";
import {
  VoxelDocument,
  composeBlockId
} from "@jolly-pixel/voxel.renderer";
import { VOXEL_MAP_ASSET } from "@jolly-pixel/voxel.renderer/engine";
import * as THREE from "three";

// Import Internal Dependencies
import { RUNTIME_COMPONENTS } from "../../src/runtime/index.ts";

// CONSTANTS
const kSlot = 2;
const kFiles: Record<string, unknown> = {
  "maps/overworld.voxelmap.json": new VoxelDocument({
    blocksets: [{
      id: "terrain",
      slot: kSlot,
      asset: {
        id: "terrain-blockset",
        kind: "blockset"
      }
    }]
  }).save(),
  "maps/terrain.blockset.json": createBlocksetFile({
    blocks: [{
      id: 1,
      name: "Grass",
      shapeId: "cube",
      collidable: true,
      faceTextures: {},
      defaultTexture: {
        col: 0,
        row: 0
      }
    }]
  })
};

class FakeProgressEvent extends Event {
  readonly lengthComputable = false;
  readonly loaded = 0;
  readonly total = 0;
}

function coordinator(): AssetCoordinator {
  const manager = new THREE.LoadingManager().setURLModifier(
    (url) => `data:application/json,${encodeURIComponent(JSON.stringify(kFiles[url]))}`
  );
  const loaders = new AssetLoaderRegistry();
  for (const definition of RUNTIME_COMPONENTS.loaders ?? []) {
    loaders.register(definition.type, definition.create(manager));
  }

  return new AssetCoordinator({
    catalog: new AssetCatalog([
      new AssetRecord({
        id: "overworld",
        kind: "voxelmap",
        path: "maps/overworld.voxelmap.json"
      }),
      new AssetRecord({
        id: "terrain-blockset",
        kind: "blockset",
        path: "maps/terrain.blockset.json"
      })
    ]),
    loaders
  });
}

describe("VoxelMapLoader", () => {
  const previous = globalThis.ProgressEvent;
  before(() => {
    globalThis.ProgressEvent = FakeProgressEvent;
  });
  after(() => {
    globalThis.ProgressEvent = previous;
  });

  it("loads a voxel map with the blocks of its blockset in the blockset's slot", async() => {
    const map = await coordinator().load(
      new AssetReference("overworld", VOXEL_MAP_ASSET)
    );

    assert.equal(map.document.blocks.get(composeBlockId(kSlot, 1))?.name, "Grass");
  });
});
