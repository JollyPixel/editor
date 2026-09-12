// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetId,
  AssetRecord
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import { resolveEditorAssets } from "../../../src/boot/assets/resolveEditorAssets.ts";

// CONSTANTS
const kWorldOne = new AssetRecord({
  id: AssetId.from("world-1"),
  kind: "voxelmap",
  source: "worlds/one.json"
});
const kWorldTwo = new AssetRecord({
  id: AssetId.from("world-2"),
  kind: "voxelmap",
  source: "worlds/two.json"
});
const kTexture = new AssetRecord({
  id: AssetId.from("texture-1"),
  kind: "pixelart",
  source: "textures/one.json"
});

describe("resolveEditorAssets", () => {
  test("falls back to the first record of each kind", async() => {
    const catalog = new AssetCatalog([kWorldOne, kWorldTwo, kTexture]);

    const assets = await resolveEditorAssets({ catalog });

    assert.strictEqual(assets.world, kWorldOne);
    assert.strictEqual(assets.texture, kTexture);
  });

  test("resolves the requested world", async() => {
    const catalog = new AssetCatalog([kWorldOne, kWorldTwo, kTexture]);

    const assets = await resolveEditorAssets({
      catalog,
      world: kWorldTwo.id
    });

    assert.strictEqual(assets.world, kWorldTwo);
  });

  test("rejects a requested world of another kind", async() => {
    const catalog = new AssetCatalog([kWorldOne, kTexture]);

    await assert.rejects(
      () => resolveEditorAssets({
        catalog,
        world: kTexture.id
      }),
      { name: "AssetKindMismatchError" }
    );
  });

  test("rejects an unknown world", async() => {
    const catalog = new AssetCatalog([kWorldOne, kTexture]);

    await assert.rejects(
      () => resolveEditorAssets({
        catalog,
        world: AssetId.from("missing")
      }),
      { name: "AssetNotFoundError" }
    );
  });

  test("rejects a catalog without any texture", async() => {
    const catalog = new AssetCatalog([kWorldOne]);

    await assert.rejects(
      () => resolveEditorAssets({ catalog }),
      { name: "AssetKindNotFoundError" }
    );
  });
});
