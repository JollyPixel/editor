// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BLOCK_PIECE_EMPTY_GROUP,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  blockOf,
  texturedSources
} from "../../../helpers/blockSources.ts";

// CONSTANTS
const kCubeSlots = ["right", "left", "top", "bottom", "front", "back"];
const kPainted = {
  tilesetId: "atlas",
  col: 0,
  row: 0
};
const kBlank = {
  tilesetId: "atlas",
  col: 1,
  row: 0
};

describe("BlockRenderSources.createPieces", () => {
  const pieces = texturedSources().createPieces();

  it("lists every slot of an untextured block as empty", () => {
    assert.deepEqual(pieces.emptySlotsOf(blockOf({})), kCubeSlots);
  });

  it("lists nothing for a painted block", () => {
    assert.deepEqual(pieces.emptySlotsOf(blockOf({ defaultTexture: kPainted })), []);
  });

  it("probes the atlas pixels for the slots mapped to a blank tile", () => {
    const block = blockOf({
      defaultTexture: kPainted,
      faceTextures: { top: kBlank, bottom: kBlank }
    });

    assert.deepEqual(pieces.emptySlotsOf(block), ["top", "bottom"]);
    assert.equal(
      pieces.geometryOf(block)!.groups[2].materialIndex,
      BLOCK_PIECE_EMPTY_GROUP
    );
  });

  it("lists nothing for an unknown shape", () => {
    assert.deepEqual(
      pieces.emptySlotsOf(
        blockOf({ shapeId: "unknown" as BlockDefinition["shapeId"] })
      ),
      []
    );
  });
});
