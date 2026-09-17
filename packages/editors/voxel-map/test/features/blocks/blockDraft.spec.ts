// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  blockDefinitionFromDraft,
  previewBlockFromDraft,
  DEFAULT_BLOCK_NAME
} from "../../../src/features/blocks/blockDraft.ts";

describe("blockDefinitionFromDraft", () => {
  it("maps the draft onto a definition with the given id", () => {
    const definition = blockDefinitionFromDraft(
      {
        name: "  Stone  ",
        shapeId: "ramp",
        tilesetId: "terrain"
      },
      7
    );

    assert.deepEqual(definition, {
      id: 7,
      name: "Stone",
      shapeId: "ramp",
      defaultTexture: {
        tilesetId: "terrain",
        col: 0,
        row: 0
      }
    });
  });

  it("falls back to the default name and tileset", () => {
    const definition = blockDefinitionFromDraft(
      {
        name: "   ",
        shapeId: "cube",
        tilesetId: ""
      },
      1
    );

    assert.equal(definition.name, DEFAULT_BLOCK_NAME);
    assert.deepEqual(definition.defaultTexture, {
      tilesetId: undefined,
      col: 0,
      row: 0
    });
  });

  it("keeps a chosen UV size on the texture", () => {
    const definition = blockDefinitionFromDraft(
      {
        name: "Stone",
        shapeId: "cube",
        tilesetId: "terrain",
        size: 64
      },
      1
    );

    assert.deepEqual(definition.defaultTexture, {
      tilesetId: "terrain",
      col: 0,
      row: 0,
      size: 64
    });
  });
});

describe("previewBlockFromDraft", () => {
  it("resolves the draft into a renderable block", () => {
    const block = previewBlockFromDraft({
      name: "Stone",
      shapeId: "stair",
      tilesetId: "terrain"
    });

    assert.equal(block.shapeId, "stair");
    assert.equal(block.collidable, true);
    assert.deepEqual(block.faceTextures, {});
    assert.deepEqual(block.defaultTexture, {
      tilesetId: "terrain",
      col: 0,
      row: 0
    });
  });
});
