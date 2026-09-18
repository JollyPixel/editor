// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { type BlockDefinition, BlockRegistry } from "../../../src/blocks/index.ts";
import { BlockShapeRegistry } from "../../../src/blocks/shape/index.ts";
import { TilesetManager } from "../../../src/tileset/index.ts";
import { BlockVariantCache } from "../../../src/mesh/variants/BlockVariantCache.ts";
import { VoxelTransform } from "../../../src/world/index.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";
import {
  makeAtlasDef,
  registerAtlas
} from "../../helpers/atlas.ts";
import {
  CUBE_ID as kCubeId,
  LEAVES_ID as kLeavesId,
  RAMP_ID as kRampId
} from "../../helpers/ids.ts";

// CONSTANTS
const kSlabId = 3;
const kAllFaces = 0b111111;

function makeCache(
  leaves?: Partial<BlockDefinition> & { shapeId?: string; }
) {
  const blockRegistry = new BlockRegistry([
    makeBlockDef(kCubeId, "cube"),
    makeBlockDef(kRampId, "ramp"),
    makeBlockDef(kSlabId, "slabBottom")
  ]);
  if (leaves) {
    const { shapeId = "cube", ...overrides } = leaves;
    blockRegistry.register(makeBlockDef(kLeavesId, shapeId, overrides));
  }
  const tilesetManager = new TilesetManager();
  registerAtlas(tilesetManager);

  const cache = new BlockVariantCache({
    blockRegistry,
    shapeRegistry: BlockShapeRegistry.createDefault(),
    tilesetManager
  });
  cache.refresh();

  return { cache, blockRegistry };
}

describe("BlockVariantCache - selfOcclusionMaskOf", () => {
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
    const { cache } = makeCache({ alphaMode: "blend" });

    assert.equal(cache.occlusionMaskOf(kLeavesId, 0), 0);
    assert.equal(cache.selfOcclusionMaskOf(kLeavesId, 0), kAllFaces);
  });

  it("reports only the faces a transparent non-cube shape covers", () => {
    const { cache } = makeCache({ shapeId: "slabBottom", alphaMode: "blend" });
    const slabMask = cache.occlusionMaskOf(kSlabId, 0);

    assert.notEqual(slabMask, 0);
    assert.notEqual(slabMask, kAllFaces);
    assert.equal(cache.selfOcclusionMaskOf(kLeavesId, 0), slabMask);
  });

  it("returns 0 for an unknown block", () => {
    const { cache } = makeCache();

    assert.equal(cache.selfOcclusionMaskOf(999, 0), 0);
  });
});

describe("BlockVariantCache - occlusionMaskOf", () => {
  it("agrees with the compiled variant for every block and transform", () => {
    const { cache } = makeCache();

    for (const blockId of [kCubeId, kRampId, kSlabId]) {
      for (let transform = 0; transform < 32; transform++) {
        const variant = cache.get(blockId, transform);
        assert.ok(variant, `block ${blockId} transform ${transform}`);
        assert.equal(cache.occlusionMaskOf(blockId, transform), variant.occlusionMask);
      }
    }
  });

  it("compiles no variant for a block whose shape is not registered", () => {
    const { cache } = makeCache({ shapeId: "unknownShape" });

    assert.equal(cache.get(kLeavesId, 0), null);
    assert.equal(cache.occlusionMaskOf(kLeavesId, 0), 0);
  });

  it("returns 0 for an unregistered block, which occludes nothing", () => {
    const { cache } = makeCache();

    assert.equal(cache.get(999, 0), null);
    assert.equal(cache.occlusionMaskOf(999, 0), 0);
  });

  it("recompiles after a registry change", () => {
    const { cache, blockRegistry } = makeCache();
    assert.notEqual(cache.occlusionMaskOf(kSlabId, 0), kAllFaces);

    blockRegistry.register(makeBlockDef(kSlabId, "cube"));
    cache.refresh();

    assert.equal(cache.occlusionMaskOf(kSlabId, 0), kAllFaces);
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
    const { cache } = makeCache({ alphaMode: "blend" });

    assert.equal(cache.occlusionMaskOf(kCubeId, 0), kAllFaces);
    for (let transform = 0; transform < 32; transform++) {
      assert.equal(cache.occlusionMaskOf(kLeavesId, transform), 0, `transform ${transform}`);
    }
  });
});

describe("BlockVariantCache - keepsCoveredFaces", () => {
  const kCases: [string, Partial<BlockDefinition>, boolean][] = [
    ["a transparent block by default", { alphaMode: "mask" }, true],
    ["a transparent block that culls them", { alphaMode: "blend", cullCoveredFaces: true }, false],
    ["an opaque block by default", {}, false],
    ["an opaque block that opts out", { cullCoveredFaces: false }, true]
  ];

  for (const [name, leaves, expected] of kCases) {
    it(`is ${expected} for ${name}`, () => {
      const { cache } = makeCache(leaves);

      assert.equal(cache.get(kLeavesId, 0)?.keepsCoveredFaces, expected);
    });
  }

  it("follows a registry change", () => {
    const { cache, blockRegistry } = makeCache({ alphaMode: "blend" });
    assert.equal(cache.get(kLeavesId, 0)?.keepsCoveredFaces, true);

    blockRegistry.register(
      makeBlockDef(kLeavesId, "cube", { alphaMode: "blend", cullCoveredFaces: true })
    );
    cache.refresh();

    assert.equal(cache.get(kLeavesId, 0)?.keepsCoveredFaces, false);
  });
});

describe("BlockVariantCache - frontFaceOf", () => {
  it("returns one cached front-sided copy of a double-sided face", () => {
    const { cache } = makeCache({ alphaMode: "blend" });

    const [face] = cache.get(kLeavesId, 0)!.faces;
    const front = cache.frontFaceOf(face);

    assert.equal(face.full, true);
    assert.equal(cache.geometryKeyAt(face.slot).surface.side, "double");
    assert.equal(cache.geometryKeyAt(front.slot).surface.side, "front");
    assert.equal(front.positions, face.positions);
    assert.equal(cache.frontFaceOf(face), front);
  });
});

describe("BlockVariantCache - missing tileset", () => {
  it("compiles no faces for a block whose tileset is not registered", () => {
    const { cache } = makeCache({
      defaultTexture: { col: 0, row: 0, tilesetId: "missing" }
    });

    assert.deepEqual(cache.get(kLeavesId, 0)?.faces, []);
  });

  it("compiles faces again once the tileset is registered", () => {
    const blockRegistry = new BlockRegistry([
      makeBlockDef(kCubeId, "cube", {
        defaultTexture: { col: 0, row: 0, tilesetId: "late" }
      })
    ]);
    const tilesetManager = new TilesetManager();
    registerAtlas(tilesetManager);
    const cache = new BlockVariantCache({
      blockRegistry,
      shapeRegistry: BlockShapeRegistry.createDefault(),
      tilesetManager
    });
    cache.refresh();
    assert.equal(cache.get(kCubeId, 0)?.faces.length, 0);

    registerAtlas(tilesetManager, makeAtlasDef({ id: "late" }));
    cache.refresh();

    assert.equal(cache.get(kCubeId, 0)?.faces.length, 6);
  });
});
