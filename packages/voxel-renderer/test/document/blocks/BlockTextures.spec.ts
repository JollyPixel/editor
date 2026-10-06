// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BlockTextures,
  resolveBlockDefinition,
  type ResolvedBlockDefinition
} from "../../../src/document/blocks/index.ts";

function makeBlock(): ResolvedBlockDefinition {
  return resolveBlockDefinition({
    id: 1,
    name: "block",
    shapeId: "cube",
    faceTextures: {
      top: { blocksetId: "b", col: 1, row: 0 },
      "front.1": { blocksetId: "b", col: 2, row: 0 },
      "top.1": { blocksetId: "b", col: 3, row: 0 }
    },
    defaultTexture: { col: 0, row: 0 }
  });
}

describe("BlockTextures", () => {
  it("iterates face references then the default texture", () => {
    assert.deepEqual([...BlockTextures.of(makeBlock())], [
      { blocksetId: "b", col: 1, row: 0 },
      { blocksetId: "b", col: 2, row: 0 },
      { blocksetId: "b", col: 3, row: 0 },
      { col: 0, row: 0 }
    ]);
  });

  it("is frozen", () => {
    assert.ok(Object.isFrozen(BlockTextures.of(makeBlock())));
  });
});

describe("BlockTextures.forSlot", () => {
  const textures = BlockTextures.of(makeBlock());

  it("takes the exact slot before its base slot", () => {
    assert.equal(textures.forSlot("top")?.col, 1);
    assert.equal(textures.forSlot("top.1")?.col, 3);
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

describe("BlockTextures.blocksetIds", () => {
  it("returns the distinct explicit blockset ids in order", () => {
    const textures = BlockTextures.of(makeBlock());

    assert.deepEqual(textures.blocksetIds(), ["b"]);
    assert.deepEqual(textures.withBlockset("a").blocksetIds(), ["b", "a"]);
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

describe("BlockTextures.withBlockset", () => {
  it("fills only the references without blockset", () => {
    const textures = BlockTextures.of(makeBlock()).withBlockset("a");

    assert.equal(textures.faceTextures.top.blocksetId, "b");
    assert.equal(textures.defaultTexture?.blocksetId, "a");
  });

  it("returns the same instance for a null blockset", () => {
    const textures = BlockTextures.of(makeBlock());

    assert.equal(textures.withBlockset(null), textures);
  });
});

describe("BlockTextures.applyTo", () => {
  it("returns the block itself when the textures are its own", () => {
    const block = makeBlock();

    assert.equal(BlockTextures.of(block).map((ref) => ref).applyTo(block), block);
  });

  it("writes the textures into a copy of the block", () => {
    const block = makeBlock();
    const applied = BlockTextures.of(block).withBlockset("a").applyTo(block);

    assert.notEqual(applied, block);
    assert.equal(applied.name, "block");
    assert.equal(applied.defaultTexture?.blocksetId, "a");
    assert.equal(block.defaultTexture?.blocksetId, undefined);
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

describe("BlockTextures sizes", () => {
  it("sets the size on every reference and reads it back", () => {
    const textures = BlockTextures.of(makeBlock()).withSize(64);

    assert.ok([...textures].every((ref) => ref.size === 64));
    assert.equal(textures.size, 64);
  });

  it("reads the size of the default texture, else of the first face", () => {
    assert.equal(BlockTextures.of(makeBlock()).size, undefined);
    assert.equal(
      new BlockTextures({ top: { col: 0, row: 0, size: 8 } }).size,
      8
    );
    assert.equal(new BlockTextures({}).size, undefined);
  });

  it("tells whether a rescale keeps every reference on the tile grid", () => {
    const rescale = {
      blocksetId: "b",
      from: 16,
      to: 32
    };

    assert.equal(
      new BlockTextures({ top: { blocksetId: "b", col: 2, row: 4 } })
        .staysOnGrid(rescale),
      true
    );
    assert.equal(
      new BlockTextures({ top: { blocksetId: "c", col: 1, row: 1 } })
        .staysOnGrid(rescale),
      true
    );
    assert.equal(BlockTextures.of(makeBlock()).staysOnGrid(rescale), false);
  });
});
