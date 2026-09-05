// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockRegistry } from "../../../src/blocks/index.ts";
import { BlockShapeRegistry } from "../../../src/blocks/shape/index.ts";
import { TilesetManager } from "../../../src/tileset/index.ts";
import { BlockVariantCache } from "../../../src/mesh/variants/BlockVariantCache.ts";
import { VoxelTransform } from "../../../src/world/index.ts";
import { mockTexture } from "../../helpers/mockTexture.ts";
import { DEFAULT_TEXTURE, makeBlockDef } from "../../helpers/blocks.ts";
import { makeAtlasDef } from "../../helpers/atlas.ts";

// CONSTANTS
const kCubeId = 1;
const kRampId = 2;
const kSlabId = 3;
const kLeavesId = 4;

function makeCache() {
  const blockRegistry = new BlockRegistry([
    makeBlockDef(kCubeId, "cube", { name: "Cube" }),
    makeBlockDef(kRampId, "ramp", { name: "Ramp" }),
    makeBlockDef(kSlabId, "slab", { name: "Slab" })
  ]);
  const shapeRegistry = BlockShapeRegistry.createDefault();
  const tilesetManager = new TilesetManager();
  tilesetManager.registerTexture(
    makeAtlasDef(),
    mockTexture()
  );

  const cache = new BlockVariantCache({
    blockRegistry,
    shapeRegistry,
    tilesetManager
  });
  cache.refresh();

  return { cache, blockRegistry };
}

describe("BlockVariantCache — selfOcclusionMaskOf", () => {
  it("matches occlusionMaskOf for an opaque block", () => {
    const { cache } = makeCache();

    for (const blockId of [kCubeId, kRampId, kSlabId]) {
      for (let transform = 0; transform < 32; transform++) {
        assert.equal(
          cache.selfOcclusionMaskOf(blockId, transform),
          cache.occlusionMaskOf(blockId, transform),
          `block ${blockId}, transform ${transform}`
        );
      }
    }
  });

  it("keeps what a transparent block covers, which occlusionMaskOf drops", () => {
    const { cache, blockRegistry } = makeCache();

    blockRegistry.register(
      makeBlockDef(kLeavesId, "cube", { name: "Leaves", transparent: true })
    );
    cache.refresh();

    assert.equal(cache.occlusionMaskOf(kLeavesId, 0), 0);
    assert.equal(cache.selfOcclusionMaskOf(kLeavesId, 0), 0b111111);
  });

  it("reports only the faces a transparent non-cube shape covers", () => {
    const { cache, blockRegistry } = makeCache();

    blockRegistry.register(
      makeBlockDef(kLeavesId, "slab", { name: "Hedge", transparent: true })
    );
    cache.refresh();

    assert.equal(
      cache.selfOcclusionMaskOf(kLeavesId, 0),
      cache.occlusionMaskOf(kSlabId, 0)
    );
  });

  it("returns 0 for an unknown block", () => {
    const { cache } = makeCache();

    assert.equal(cache.selfOcclusionMaskOf(999, 0), 0);
  });
});

describe("BlockVariantCache — occlusionMaskOf", () => {
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
      id: kSlabId,
      name: "Now a cube",
      shapeId: "cube",
      faceTextures: {},
      defaultTexture: DEFAULT_TEXTURE,
      collidable: true
    });
    cache.refresh();

    assert.notEqual(cache.occlusionMaskOf(kSlabId, 0), before);
    assert.equal(
      cache.occlusionMaskOf(kSlabId, 0),
      cache.occlusionMaskOf(kCubeId, 0)
    );
  });

  it("masks the transform to the five bits a packed voxel carries", () => {
    const { cache } = makeCache();
    const transform = new VoxelTransform({ rotation: 1, flipX: true }).packed;

    assert.equal(
      cache.occlusionMaskOf(kRampId, transform),
      cache.occlusionMaskOf(kRampId, transform + 32)
    );
  });

  it("returns 0 for a transparent block, whatever its shape covers", () => {
    const { cache, blockRegistry } = makeCache();

    // Same shape as the reference cube, which occludes all six faces.
    assert.equal(cache.occlusionMaskOf(kCubeId, 0), 0b111111);

    blockRegistry.register(
      makeBlockDef(kLeavesId, "cube", { name: "Leaves", transparent: true })
    );
    cache.refresh();

    for (let transform = 0; transform < 32; transform++) {
      assert.equal(
        cache.occlusionMaskOf(kLeavesId, transform),
        0,
        `transform ${transform}`
      );
    }
  });
});
