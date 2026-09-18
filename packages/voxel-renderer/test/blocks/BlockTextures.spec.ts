// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BlockTextures,
  resolveBlockDefinition,
  type ResolvedBlockDefinition
} from "../../src/blocks/index.ts";

function makeBlock(): ResolvedBlockDefinition {
  return resolveBlockDefinition({
    id: 1,
    name: "block",
    shapeId: "cube",
    faceTextures: {
      top: { tilesetId: "b", col: 1, row: 0 },
      "front.1": { tilesetId: "b", col: 2, row: 0 }
    },
    defaultTexture: { col: 0, row: 0 }
  });
}

describe("BlockTextures", () => {
  it("iterates face references then the default texture", () => {
    assert.deepEqual([...BlockTextures.of(makeBlock())], [
      { tilesetId: "b", col: 1, row: 0 },
      { tilesetId: "b", col: 2, row: 0 },
      { col: 0, row: 0 }
    ]);
  });

  it("is frozen", () => {
    assert.ok(Object.isFrozen(BlockTextures.of(makeBlock())));
  });
});

describe("BlockTextures.forSlot", () => {
  const textures = BlockTextures.of(makeBlock());

  it("takes the exact slot first", () => {
    assert.equal(textures.forSlot("top")?.col, 1);
    assert.equal(textures.forSlot("front.1")?.col, 2);
  });

  it("falls back to the base slot, then to the default texture", () => {
    assert.equal(textures.forSlot("top.2")?.col, 1);
    assert.equal(textures.forSlot("back")?.col, 0);
  });

  it("is undefined without a default texture", () => {
    assert.equal(new BlockTextures({}).forSlot("top"), undefined);
  });
});

describe("BlockTextures.spanFor", () => {
  const textures = BlockTextures.of(makeBlock());
  const span = { u: 1, v: Math.SQRT2 };

  it("keeps the span of a slot with its own texture", () => {
    assert.equal(textures.spanFor("top", span), span);
    assert.equal(textures.spanFor("top.2", span), span);
  });

  it("falls back to one tile for a slot sharing the default texture", () => {
    assert.deepEqual(textures.spanFor("back", span), { u: 1, v: 1 });
  });
});

describe("BlockTextures.tilesetIds", () => {
  it("returns the distinct explicit tileset ids in order", () => {
    const textures = BlockTextures.of(makeBlock());

    assert.deepEqual(textures.tilesetIds(), ["b"]);
    assert.deepEqual(textures.withTileset("a").tilesetIds(), ["b", "a"]);
  });
});

describe("BlockTextures.map", () => {
  it("returns the same instance when nothing changes", () => {
    const textures = BlockTextures.of(makeBlock());

    assert.equal(textures.map((ref) => ref), textures);
  });

  it("maps every reference", () => {
    const textures = BlockTextures.of(makeBlock()).map((ref) => {
      return { ...ref, col: ref.col + 1 };
    });

    assert.equal(textures.faceTextures.top.col, 2);
    assert.equal(textures.defaultTexture?.col, 1);
  });
});

describe("BlockTextures.withTileset", () => {
  it("fills only the references without tileset", () => {
    const textures = BlockTextures.of(makeBlock()).withTileset("a");

    assert.equal(textures.faceTextures.top.tilesetId, "b");
    assert.equal(textures.defaultTexture?.tilesetId, "a");
  });

  it("returns the same instance for a null tileset", () => {
    const textures = BlockTextures.of(makeBlock());

    assert.equal(textures.withTileset(null), textures);
  });
});

describe("BlockTextures.applyTo", () => {
  it("returns the block itself when the textures are its own", () => {
    const block = makeBlock();

    assert.equal(BlockTextures.of(block).map((ref) => ref).applyTo(block), block);
  });

  it("writes the textures into a copy of the block", () => {
    const block = makeBlock();
    const applied = BlockTextures.of(block).withTileset("a").applyTo(block);

    assert.notEqual(applied, block);
    assert.equal(applied.name, "block");
    assert.equal(applied.defaultTexture?.tilesetId, "a");
    assert.equal(block.defaultTexture?.tilesetId, undefined);
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

    const applied = BlockTextures.of(block)
      .map((ref) => {
        return { ...ref, row: 1 };
      })
      .applyTo(block);

    assert.equal(applied.faceTextures.top.row, 1);
    assert.equal("defaultTexture" in applied, false);
  });

  it("drops the default texture of the block when the textures have none", () => {
    const applied = new BlockTextures({}).applyTo(makeBlock());

    assert.deepEqual(applied.faceTextures, {});
    assert.equal("defaultTexture" in applied, false);
  });
});
