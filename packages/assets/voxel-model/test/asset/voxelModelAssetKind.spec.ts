// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetKindRegistry } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  createVoxelModelDocument,
  VOXEL_MODEL_EXTENSION,
  VOXEL_MODEL_KIND,
  voxelModelAssetKind
} from "#src/index.ts";

describe("voxelModelAssetKind", () => {
  test("rebinds the texture reference on a copied model", () => {
    const handler = voxelModelAssetKind();
    const state = handler.create("model");
    state.load(createVoxelModelDocument({
      texture: { id: "original", kind: "pixelart" }
    }));

    handler.rebind?.(state, new Map([["original", "copied"]]));

    assert.deepEqual(handler.dependencies?.(state), [
      { id: "copied", kind: "pixelart" }
    ]);
  });

  test("declares its kind and claims .voxelmodel.json paths", () => {
    const handler = voxelModelAssetKind();

    assert.strictEqual(handler.kind, VOXEL_MODEL_KIND);
    assert.deepEqual(Object.keys(handler.extensions), [VOXEL_MODEL_EXTENSION]);
    assert.strictEqual(handler.match, undefined);
  });

  test("resolves its documents but leaves plain JSON to the fallback", () => {
    const registry = new AssetKindRegistry([voxelModelAssetKind()]);

    assert.strictEqual(
      registry.resolve("models/hero.voxelmodel.json").kind,
      VOXEL_MODEL_KIND
    );
    assert.strictEqual(registry.resolve("models/hero.json").kind, "binary");
    assert.deepEqual(Object.keys(registry.contentTypes()), [
      VOXEL_MODEL_EXTENSION
    ]);
  });
});
