// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Face, type BlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { findBlocksReferencingTileset } from "../../src/lib/blockTextureTiles.ts";

function makeBlock(
  id: number,
  options: {
    defaultTexture?: BlockDefinition["defaultTexture"];
    faceTextures?: BlockDefinition["faceTextures"];
  }
): BlockDefinition {
  return {
    id,
    name: `Block${id}`,
    shapeId: "cube",
    collidable: true,
    faceTextures: options.faceTextures ?? {},
    defaultTexture: options.defaultTexture
  };
}

describe("findBlocksReferencingTileset", () => {
  it("matches a block via defaultTexture", () => {
    const block = makeBlock(1, { defaultTexture: { tilesetId: "atlas", col: 0, row: 0 } });

    const result = findBlocksReferencingTileset([block], "atlas", 16);

    assert.equal(result.length, 1);
    assert.equal(result[0].block, block);
    assert.deepEqual(result[0].rects, [{ x: 0, y: 0, width: 16, height: 16 }]);
  });

  it("matches a block via a faceTextures entry, independently of defaultTexture", () => {
    const block = makeBlock(1, {
      defaultTexture: { tilesetId: "other", col: 0, row: 0 },
      faceTextures: { [Face.PosY]: { tilesetId: "atlas", col: 2, row: 1 } }
    });

    const result = findBlocksReferencingTileset([block], "atlas", 16);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0].rects, [{ x: 32, y: 16, width: 16, height: 16 }]);
  });

  it("collects rects from every matching reference (default + multiple faces)", () => {
    const block = makeBlock(1, {
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 },
      faceTextures: {
        [Face.PosY]: { tilesetId: "atlas", col: 1, row: 0 },
        [Face.NegY]: { tilesetId: "other", col: 5, row: 5 }
      }
    });

    const result = findBlocksReferencingTileset([block], "atlas", 16);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0].rects, [
      { x: 0, y: 0, width: 16, height: 16 },
      { x: 16, y: 0, width: 16, height: 16 }
    ]);
  });

  it("excludes blocks that reference a different tileset entirely", () => {
    const block = makeBlock(1, { defaultTexture: { tilesetId: "other", col: 0, row: 0 } });

    const result = findBlocksReferencingTileset([block], "atlas", 16);

    assert.equal(result.length, 0);
  });

  it("excludes a block with no defaultTexture and no matching face", () => {
    const block = makeBlock(1, {});

    const result = findBlocksReferencingTileset([block], "atlas", 16);

    assert.equal(result.length, 0);
  });
});
