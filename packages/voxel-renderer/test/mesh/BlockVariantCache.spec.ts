// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockRegistry } from "../../src/blocks/BlockRegistry.ts";
import { BlockShapeRegistry } from "../../src/blocks/BlockShapeRegistry.ts";
import { TilesetManager } from "../../src/tileset/TilesetManager.ts";
import { BlockVariantCache } from "../../src/mesh/BlockVariantCache.ts";
import { packTransform } from "../../src/utils/math.ts";

// CONSTANTS
const kCubeId = 1;
const kRampId = 2;
const kSlabId = 3;
const kLeavesId = 4;
const kDefaultTexture = { col: 0, row: 0 };

function mockTexture(): any {
  return {
    magFilter: 0,
    minFilter: 0,
    colorSpace: "",
    generateMipmaps: true,
    image: { width: 64, height: 64 }
  };
}

function makeCache() {
  const blockRegistry = new BlockRegistry([
    { id: kCubeId, name: "Cube", shapeId: "cube", faceTextures: {}, defaultTexture: kDefaultTexture, collidable: true },
    { id: kRampId, name: "Ramp", shapeId: "ramp", faceTextures: {}, defaultTexture: kDefaultTexture, collidable: true },
    { id: kSlabId, name: "Slab", shapeId: "slab", faceTextures: {}, defaultTexture: kDefaultTexture, collidable: true }
  ]);
  const shapeRegistry = BlockShapeRegistry.createDefault();
  const tilesetManager = new TilesetManager();
  tilesetManager.registerTexture(
    { id: "atlas", src: "/atlas.png", tileSize: 16, cols: 4, rows: 4 },
    mockTexture()
  );

  const cache = new BlockVariantCache({ blockRegistry, shapeRegistry, tilesetManager });
  cache.refresh();

  return { cache, blockRegistry };
}

describe("BlockVariantCache.occlusionMaskOf", () => {
  it("agrees with the compiled variant for every block and transform", () => {
    const { cache } = makeCache();

    for (const blockId of [kCubeId, kRampId, kSlabId]) {
      for (let transform = 0; transform < 32; transform++) {
        const variant = cache.get(blockId, transform);
        assert.equal(
          cache.occlusionMaskOf(blockId, transform),
          variant === null ? 0 : variant.occlusionMask,
          `block ${blockId} transform ${transform}`
        );
      }
    }
  });

  it("returns 0 for an unregistered block, which occludes nothing", () => {
    const { cache } = makeCache();

    assert.equal(cache.get(999, 0), null);
    assert.equal(cache.occlusionMaskOf(999, 0), 0);
  });

  it("returns the same mask on the cached second call", () => {
    const { cache } = makeCache();
    const first = cache.occlusionMaskOf(kCubeId, 0);

    assert.equal(cache.occlusionMaskOf(kCubeId, 0), first);
  });

  it("recompiles after a registry change", () => {
    const { cache, blockRegistry } = makeCache();
    const before = cache.occlusionMaskOf(kSlabId, 0);

    // Re-registering the id as a full cube changes which faces it occludes.
    blockRegistry.register({
      id: kSlabId, name: "Now a cube", shapeId: "cube",
      faceTextures: {}, defaultTexture: kDefaultTexture, collidable: true
    });
    cache.refresh();

    assert.notEqual(cache.occlusionMaskOf(kSlabId, 0), before);
    assert.equal(cache.occlusionMaskOf(kSlabId, 0), cache.occlusionMaskOf(kCubeId, 0));
  });

  it("masks the transform to the five bits a packed voxel carries", () => {
    const { cache } = makeCache();
    const transform = packTransform(1, true, false, false);

    assert.equal(
      cache.occlusionMaskOf(kRampId, transform),
      cache.occlusionMaskOf(kRampId, transform + 32)
    );
  });

  it("returns 0 for a transparent block, whatever its shape covers", () => {
    const { cache, blockRegistry } = makeCache();

    // Same shape as the reference cube, which occludes all six faces.
    assert.equal(cache.occlusionMaskOf(kCubeId, 0), 0b111111);

    blockRegistry.register({
      id: kLeavesId, name: "Leaves", shapeId: "cube", transparent: true,
      faceTextures: {}, defaultTexture: kDefaultTexture, collidable: true
    });
    cache.refresh();

    for (let transform = 0; transform < 32; transform++) {
      assert.equal(cache.occlusionMaskOf(kLeavesId, transform), 0, `transform ${transform}`);
    }
  });
});
