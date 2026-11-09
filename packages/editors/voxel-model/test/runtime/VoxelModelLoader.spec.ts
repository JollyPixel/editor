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
import { createVoxelModelFile } from "@jolly-pixel/asset.voxel-model";
import {
  PIXEL_ART_DOCUMENT,
  RUNTIME_COMPONENTS as PIXEL_ART_RUNTIME
} from "@jolly-pixel/editor.pixel-art/runtime";
import { createPixelArtFile } from "@jolly-pixel/pixel-draw.renderer";
import * as THREE from "three";

// Import Internal Dependencies
import { RUNTIME_COMPONENTS } from "#src/runtime/index.ts";
import { VOXEL_MODEL_SOURCE } from "#src/viewer/VoxelModelSource.ts";

// CONSTANTS
const kFiles: Record<string, unknown> = {
  "models/truck.voxelmodel.json": createVoxelModelFile({
    texture: {
      id: "truck-texture",
      kind: "pixelart"
    },
    blocks: ["Chassis", "Wheel"]
  }),
  "models/truck.pixelart": createPixelArtFile({ x: 32, y: 16 })
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
  for (const definition of [
    ...RUNTIME_COMPONENTS.loaders ?? [],
    ...PIXEL_ART_RUNTIME.loaders ?? []
  ]) {
    loaders.register(definition.type, definition.create(manager));
  }

  return new AssetCoordinator({
    catalog: new AssetCatalog([
      new AssetRecord({
        id: "truck",
        kind: "voxelmodel",
        path: "models/truck.voxelmodel.json"
      }),
      new AssetRecord({
        id: "truck-texture",
        kind: "pixelart",
        path: "models/truck.pixelart"
      })
    ]),
    loaders
  });
}

describe("VoxelModelLoader", () => {
  const previous = globalThis.ProgressEvent;
  before(() => {
    globalThis.ProgressEvent = FakeProgressEvent;
  });
  after(() => {
    globalThis.ProgressEvent = previous;
  });

  it("loads a voxel model with the pixel-art texture it references", async() => {
    const assets = coordinator();

    const model = await assets.load(new AssetReference("truck", VOXEL_MODEL_SOURCE));

    assert.deepEqual(
      Array.from(model.document.tree.blocks(), (block) => block.name),
      ["Chassis", "Wheel"]
    );
    assert.deepEqual(model.texture.size(), { x: 32, y: 16 });
    assert.equal(
      assets.request(new AssetReference("truck-texture", PIXEL_ART_DOCUMENT)).status,
      "ready"
    );
  });
});
