// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { type BlockDefinition, BlockRegistry } from "../../../../src/document/blocks/index.ts";
import { BlockShapeRegistry } from "../../../../src/document/blocks/shape/index.ts";
import { MISSING_BLOCKSET_ID } from "../../../../src/document/blocksets/index.ts";
import { BlocksetAtlases } from "../../../../src/view/atlases/index.ts";
import { BlockVariantCache } from "../../../../src/view/meshing/variants/BlockVariantCache.ts";
import type { BlockVariantFace } from "../../../../src/view/meshing/variants/types.ts";
import { FACE } from "../../../../src/document/geometry/faceDirection.ts";
import { makeBlockDef } from "../../../helpers/blocks.ts";
import { makeAtlasDef, registerAtlas } from "../../../helpers/atlas.ts";
import { mockTexture } from "../../../helpers/mockTexture.ts";
import { makeLogger } from "../../../helpers/fakes.ts";
import {
  CUBE_ID as kCubeId,
  LEAVES_ID as kLeavesId,
  RAMP_ID as kRampId
} from "../../../helpers/ids.ts";

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
  const atlases = new BlocksetAtlases();
  registerAtlas(atlases);

  const cache = new BlockVariantCache({
    blockRegistry,
    shapeRegistry: BlockShapeRegistry.createDefault(),
    atlases
  });
  cache.refresh();

  return { cache, blockRegistry };
}

function readTileUvs(
  face: BlockVariantFace
): number[] {
  return Array.from(
    face.uvs,
    (uv) => Math.round(uv / 65535 * 1000) / 1000
  );
}

describe("BlockVariantCache - missing blockset", () => {
  it("draws a block of an undeclared blockset with the missing texture", () => {
    const { cache } = makeCache({
      defaultTexture: { col: 3, row: 2, rotation: 1, blocksetId: "gone" }
    });

    const variant = cache.get(kLeavesId, 0)!;
    const plain = cache.get(kCubeId, 0)!;

    assert.equal(variant.faces.length, 6);
    assert.equal(variant.occlusionMask, kAllFaces);
    variant.faces.forEach((face, index) => {
      assert.equal(cache.geometryKeyAt(face.slot).blocksetId, MISSING_BLOCKSET_ID);
      assert.deepEqual(readTileUvs(face), readTileUvs(plain.faces[index]));
    });
  });

  it("neither draws nor occludes while a declared blockset has no texture", () => {
    const blockRegistry = new BlockRegistry([
      makeBlockDef(kCubeId, "cube", {
        defaultTexture: { col: 0, row: 0, blocksetId: "late" }
      })
    ]);
    const atlases = new BlocksetAtlases();
    registerAtlas(atlases);
    atlases.blocksets.add(makeAtlasDef({ id: "late" }));
    const cache = new BlockVariantCache({
      blockRegistry,
      shapeRegistry: BlockShapeRegistry.createDefault(),
      atlases
    });
    cache.refresh();
    assert.equal(cache.get(kCubeId, 0)?.faces.length, 0);
    assert.equal(cache.resolveOcclusionMask(kCubeId, 0), 0);
    assert.equal(cache.resolveSelfOcclusionMask(kCubeId, 0), 0);

    atlases.registerTexture("late", mockTexture());
    cache.refresh();

    assert.equal(cache.get(kCubeId, 0)?.faces.length, 6);
    assert.equal(cache.resolveOcclusionMask(kCubeId, 0), kAllFaces);
  });
});

describe("BlockVariantCache - tile rotation", () => {
  it("turns each face's tile UVs a quarter clockwise", () => {
    const { cache } = makeCache({
      defaultTexture: { col: 0, row: 0, rotation: 1 }
    });
    const plain = cache.get(kCubeId, 0)!;
    const rotated = cache.get(kLeavesId, 0)!;

    assert.equal(rotated.faces.length, plain.faces.length);
    rotated.faces.forEach((face, index) => {
      const source = readTileUvs(plain.faces[index]);
      const turned = readTileUvs(face);
      for (let i = 0; i < face.vertexCount; i++) {
        assert.deepEqual(
          [turned[i * 2], turned[(i * 2) + 1]],
          [source[(i * 2) + 1], 1 - source[i * 2]]
        );
      }
      assert.equal(
        face.full,
        plain.faces[index].full,
        "a whole-tile face stays full once rotated"
      );
    });
  });
});

describe("BlockVariantCache - unknown faceTextures keys", () => {
  function makeWarningCache(
    faceTextures: BlockDefinition["faceTextures"]
  ) {
    const warnings: string[] = [];
    const blockRegistry = new BlockRegistry([
      makeBlockDef(kCubeId, "cube", { faceTextures })
    ]);
    const atlases = new BlocksetAtlases();
    registerAtlas(atlases);
    const cache = new BlockVariantCache({
      blockRegistry,
      shapeRegistry: BlockShapeRegistry.createDefault(),
      atlases,
      logger: makeLogger(warnings)
    });
    cache.refresh();

    return { cache, blockRegistry, warnings };
  }

  it("warns once per registration, whatever the transform", () => {
    const { cache, blockRegistry, warnings } = makeWarningCache({
      negY: { col: 1, row: 0 }
    });
    cache.get(kCubeId, 0);
    cache.get(kCubeId, 1);
    blockRegistry.register(makeBlockDef(kRampId, "ramp"));
    cache.refresh();
    cache.get(kCubeId, 0);

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /negY/);
    assert.match(warnings[0], /shape 'cube'/);
  });

  it("warns again once the block is registered anew", () => {
    const { cache, blockRegistry, warnings } = makeWarningCache({
      negY: { col: 1, row: 0 }
    });
    cache.get(kCubeId, 0);
    blockRegistry.register(makeBlockDef(kCubeId, "cube", {
      faceTextures: { posX: { col: 1, row: 0 } }
    }));
    cache.refresh();
    cache.get(kCubeId, 0);

    assert.equal(warnings.length, 2);
    assert.match(warnings[1], /posX/);
  });

  it("stays silent for slot and face keys", () => {
    const { cache, warnings } = makeWarningCache({
      top: { col: 1, row: 0 },
      [FACE.NegY]: { col: 1, row: 0 }
    });
    cache.get(kCubeId, 0);

    assert.deepEqual(warnings, []);
  });
});
