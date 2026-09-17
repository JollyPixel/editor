// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  assignMissingTileset,
  blockTileRefs,
  blockTilesetIds,
  mapBlockTileRefs,
  resolveBlockDefinition,
  type ResolvedBlockDefinition
} from "../../src/blocks/index.ts";

function makeBlock(): ResolvedBlockDefinition {
  return resolveBlockDefinition({
    id: 1,
    name: "block",
    shapeId: "cube",
    faceTextures: {
      top: { tilesetId: "b", col: 1, row: 0 }
    },
    defaultTexture: { col: 0, row: 0 }
  });
}

describe("blockTileRefs", () => {
  it("lists face references then the default texture", () => {
    assert.deepEqual(blockTileRefs(makeBlock()), [
      { tilesetId: "b", col: 1, row: 0 },
      { col: 0, row: 0 }
    ]);
  });
});

describe("blockTilesetIds", () => {
  it("returns the distinct explicit tileset ids", () => {
    assert.deepEqual(blockTilesetIds(makeBlock()), ["b"]);
    assert.deepEqual(blockTilesetIds(assignMissingTileset(makeBlock(), "a")), ["b", "a"]);
  });
});

describe("mapBlockTileRefs", () => {
  it("returns the same block when nothing changes", () => {
    const block = makeBlock();

    assert.equal(mapBlockTileRefs(block, (ref) => ref), block);
  });

  it("maps every reference into a new block", () => {
    const block = mapBlockTileRefs(makeBlock(), (ref) => {
      return { ...ref, col: ref.col + 1 };
    });

    assert.equal(block.faceTextures.top.col, 2);
    assert.equal(block.defaultTexture?.col, 1);
  });

  it("keeps a block without default texture free of the key", () => {
    const block = resolveBlockDefinition({
      id: 2,
      name: "faces",
      shapeId: "cube",
      faceTextures: {
        top: { col: 0, row: 0 }
      }
    });

    const mapped = mapBlockTileRefs(block, (ref) => {
      return { ...ref, row: 1 };
    });

    assert.equal("defaultTexture" in mapped, false);
  });
});

describe("assignMissingTileset", () => {
  it("fills only the references without tileset", () => {
    const block = assignMissingTileset(makeBlock(), "a");

    assert.equal(block.faceTextures.top.tilesetId, "b");
    assert.equal(block.defaultTexture?.tilesetId, "a");
  });

  it("returns the block unchanged without fallback", () => {
    const block = makeBlock();

    assert.equal(assignMissingTileset(block, null), block);
  });
});
