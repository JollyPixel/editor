// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BlockDraft,
  DEFAULT_BLOCK_NAME
} from "../../../../src/features/blocks/dialogs/BlockDraft.ts";

describe("BlockDraft", () => {
  it("starts as a named cube on the given blockset", () => {
    const draft = BlockDraft.create("terrain");

    assert.equal(draft.name, DEFAULT_BLOCK_NAME);
    assert.equal(draft.shapeId, "cube");
    assert.equal(draft.blocksetId, "terrain");
    assert.equal(draft.size, undefined);
  });

  it("changes one field at a time into a new draft", () => {
    const draft = BlockDraft.create("terrain");
    const sized = draft.with({ size: 64 });

    assert.notEqual(sized, draft);
    assert.equal(sized.size, 64);
    assert.equal(sized.with({ name: "Stone" }).size, 64);
    assert.equal(draft.size, undefined);
  });

  describe("toDefinition", () => {
    it("maps the draft onto a definition with the given id", () => {
      const definition = new BlockDraft({
        name: "  Stone  ",
        shapeId: "ramp",
        blocksetId: "terrain"
      }).toDefinition(7);

      assert.deepEqual(definition, {
        id: 7,
        name: "Stone",
        shapeId: "ramp",
        defaultTexture: {
          blocksetId: "terrain",
          col: 0,
          row: 0
        }
      });
    });

    it("falls back to the default name and blockset", () => {
      const definition = new BlockDraft({
        name: "   ",
        shapeId: "cube",
        blocksetId: ""
      }).toDefinition(1);

      assert.equal(definition.name, DEFAULT_BLOCK_NAME);
      assert.deepEqual(definition.defaultTexture, {
        blocksetId: undefined,
        col: 0,
        row: 0
      });
    });

    it("keeps a chosen UV size on the texture", () => {
      const definition = BlockDraft.create("terrain")
        .with({ size: 64 })
        .toDefinition(1);

      assert.deepEqual(definition.defaultTexture, {
        blocksetId: "terrain",
        col: 0,
        row: 0,
        size: 64
      });
    });

    it("places the texture on the given tile", () => {
      const definition = BlockDraft.create("terrain")
        .toDefinition(1, { col: 3, row: 2 });

      assert.deepEqual(definition.defaultTexture, {
        blocksetId: "terrain",
        col: 3,
        row: 2
      });
    });
  });

  it("resolves into a renderable preview block", () => {
    const block = BlockDraft.create("terrain")
      .with({ shapeId: "stair" })
      .preview();

    assert.equal(block.shapeId, "stair");
    assert.equal(block.collidable, true);
    assert.deepEqual(block.faceTextures, {});
    assert.deepEqual(block.defaultTexture, {
      blocksetId: "terrain",
      col: 0,
      row: 0
    });
  });
});
