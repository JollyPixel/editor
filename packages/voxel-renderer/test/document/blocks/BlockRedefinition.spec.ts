// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition,
  type ResolvedBlockDefinition
} from "../../../src/document/blocks/index.ts";
import { redefinitionOf } from "../../../src/document/blocks/BlockRedefinition.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";
import { CUBE_ID } from "../../helpers/ids.ts";

function cube(
  overrides: Partial<BlockDefinition> = {}
): ResolvedBlockDefinition {
  return resolveBlockDefinition(makeBlockDef(CUBE_ID, "cube", overrides));
}

describe("redefinitionOf", () => {
  it("reports a block with no previous definition as added", () => {
    assert.equal(redefinitionOf(undefined, cube()), "added");
  });

  it("reports a change of name or properties alone as metadata", () => {
    const next = cube({
      name: "Granite",
      properties: { hardness: 3 }
    });

    assert.equal(redefinitionOf(cube(), next), "metadata");
  });

  it("reports an identical definition as metadata", () => {
    assert.equal(redefinitionOf(cube(), cube()), "metadata");
  });

  it("reports moved tile regions as tiles, whatever happened to the name", () => {
    const moved = cube({
      name: "Granite",
      defaultTexture: { col: 3, row: 1, size: 32 }
    });
    const movedFace = cube({
      faceTextures: { top: { col: 1, row: 0 } }
    });

    assert.equal(redefinitionOf(cube(), moved), "tiles");
    assert.equal(
      redefinitionOf(cube({ faceTextures: { top: { col: 0, row: 0 } } }), movedFace),
      "tiles"
    );
  });

  it("reports a turned or relinked tile as a mesh change", () => {
    const turned = cube({
      defaultTexture: { col: 0, row: 0, rotation: 1 }
    });
    const relinked = cube({
      defaultTexture: { col: 0, row: 0, tilesetId: "stone" }
    });

    assert.equal(redefinitionOf(cube(), turned), "mesh");
    assert.equal(redefinitionOf(cube(), relinked), "mesh");
  });

  it("reports a change of shape, alpha mode or blend group as occlusion", () => {
    const slab = resolveBlockDefinition(makeBlockDef(CUBE_ID, "slabBottom"));

    assert.equal(redefinitionOf(cube(), slab), "occlusion");
    assert.equal(redefinitionOf(cube(), cube({ alphaMode: "mask" })), "occlusion");
    assert.equal(redefinitionOf(cube(), cube({ blendGroup: "grass" })), "occlusion");
  });

  it("ignores the key order of the face textures", () => {
    const previous = cube({
      faceTextures: {
        top: { col: 0, row: 0 },
        bottom: { col: 1, row: 0 }
      }
    });
    const next = cube({
      faceTextures: {
        bottom: { col: 1, row: 0 },
        top: { col: 0, row: 0 }
      }
    });

    assert.equal(redefinitionOf(previous, next), "metadata");
  });
});
