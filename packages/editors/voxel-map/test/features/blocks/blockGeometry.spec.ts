// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  TilesetAtlases,
  VoxelTransform,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  buildBlockGeometry,
  emptyTextureSlots
} from "../../../src/features/blocks/blockGeometry.ts";
import {
  blockOf,
  sourcesOf,
  texturedSources
} from "../../helpers/blockSources.ts";

// CONSTANTS
const kCubeSlots = ["right", "left", "top", "bottom", "front", "back"];
const kSources = sourcesOf(new TilesetAtlases());
const kTextured = texturedSources();
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

describe("buildBlockGeometry", () => {
  it("keeps the geometry in block space", () => {
    const geometry = buildBlockGeometry(blockOf({ shapeId: "ramp" }), kSources)!;
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;

    assert.deepEqual(min.toArray(), [0, 0, 0]);
    assert.deepEqual(max.toArray(), [1, 1, 1]);
  });

  it("orients the geometry with the given transform", () => {
    const block = blockOf({ shapeId: "ramp" });
    const identity = buildBlockGeometry(block, kSources)!;
    const turned = buildBlockGeometry(
      block,
      kSources,
      new VoxelTransform({ rotation: 1 })
    )!;

    assert.notDeepEqual(
      turned.getAttribute("position").array,
      identity.getAttribute("position").array
    );
    assert.deepEqual(turned.groups, identity.groups);
  });

  it("returns null for an unknown shape", () => {
    assert.equal(
      buildBlockGeometry(blockOf({ shapeId: "missing" }), kSources),
      null
    );
  });
});

describe("emptyTextureSlots", () => {
  it("lists every slot of an untextured block", () => {
    assert.deepEqual(emptyTextureSlots(blockOf({}), kTextured), kCubeSlots);
  });

  it("lists nothing for a painted block", () => {
    assert.deepEqual(
      emptyTextureSlots(blockOf({ defaultTexture: kPainted }), kTextured),
      []
    );
  });

  it("lists only the slots mapped to a blank tile", () => {
    const block = blockOf({
      defaultTexture: kPainted,
      faceTextures: { top: kBlank, bottom: kBlank }
    });

    assert.deepEqual(emptyTextureSlots(block, kTextured), ["top", "bottom"]);
  });

  it("lists nothing for an unknown shape", () => {
    assert.deepEqual(
      emptyTextureSlots(
        blockOf({ shapeId: "unknown" as BlockDefinition["shapeId"] }),
        kSources
      ),
      []
    );
  });
});
